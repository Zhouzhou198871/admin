"use strict";
const API_BASE="https://shop.lynli.me";
const TOKEN_KEY="qingtian_shop_token";
const $=s=>document.querySelector(s);
const REMEMBER_EMAIL_KEY="qingtian_admin_remembered_email";
const rememberedEmail=localStorage.getItem(REMEMBER_EMAIL_KEY);
if(rememberedEmail){$("#loginEmail").value=rememberedEmail;$("#rememberPassword").checked=true}
const pageNames={overview:"经营总览",orders:"订单管理",users:"用户管理",products:"商品与库存",nodes:"节点服务",support:"在线客服",email:"邮件系统",notices:"公告管理",upstream:"上游采购中心",payments:"支付系统",recharge:"余额充值",bots:"机器人管理"};
let toastTimer;
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600)}
function authHeaders(extra={}){return {...extra,Authorization:"Bearer "+(localStorage.getItem(TOKEN_KEY)||"")}}
async function adminRequest(path,options={}){const response=await fetchWithTimeout(API_BASE+path,{...options,headers:authHeaders(options.headers||{})},12000);let data={};try{data=await response.json()}catch{}if(!response.ok||!data.ok)throw new Error(data.error||"request_failed");return data}
async function verifyAdmin(){const token=localStorage.getItem(TOKEN_KEY);if(!token){document.body.classList.remove("authenticated");return false}try{await adminRequest("/api/admin/session");document.body.classList.add("authenticated");return true}catch(error){const denied=["unauthorized","invalid_token","token_expired","admin_forbidden"].includes(error.message);if(denied)localStorage.removeItem(TOKEN_KEY);document.body.classList.remove("authenticated");$("#loginError").textContent=denied?"登录状态已失效，请重新登录。":"暂时无法连接验证服务，请检查网络后重试。";return false}}
async function fetchWithTimeout(url,options={},timeoutMs=12000){
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
 try{return await fetch(url,{...options,signal:controller.signal})}
 catch(error){if(error.name==="AbortError")throw new Error("请求超时，请检查网络后重试。");throw error}
 finally{clearTimeout(timer)}
}
$("#adminLoginForm").addEventListener("submit",async e=>{
 e.preventDefault();const btn=$("#loginSubmit"),err=$("#loginError");btn.disabled=true;err.textContent="正在核对账号密码…";btn.textContent="正在登录…";
 try{
  const email=$("#loginEmail").value.trim().toLowerCase(),password=$("#loginPassword").value,remember=$("#rememberPassword").checked;
  if(remember)localStorage.setItem(REMEMBER_EMAIL_KEY,email);else localStorage.removeItem(REMEMBER_EMAIL_KEY);
  const response=await fetchWithTimeout(API_BASE+"/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});
  const data=await response.json();if(!response.ok||!data.token)throw new Error(data.error||"invalid_credentials");
  localStorage.setItem(TOKEN_KEY,data.token);err.textContent="账号验证通过，正在确认管理员权限…";btn.textContent="确认管理权限…";
  await adminRequest("/api/admin/session");
  if(remember&&window.PasswordCredential&&navigator.credentials&&navigator.credentials.store){try{await navigator.credentials.store(new PasswordCredential({id:email,password,name:"晴天账号铺管理后台"}))}catch(saveError){console.info("Browser password manager did not accept the credential",saveError)}}
  if(!remember)$("#loginPassword").value="";$("#loginScreen").hidden=true;document.body.classList.add("authenticated");err.textContent="";checkApi();showPage("overview");
 }catch(error){
  localStorage.removeItem(TOKEN_KEY);
  err.textContent=error.message==="admin_forbidden"||error.message==="unauthorized"?"此账号尚未获得管理员权限。":error.message==="invalid_credentials"?"邮箱或密码不正确。":error.message||"登录失败，请稍后重试。";
 }finally{btn.disabled=false;btn.innerHTML='登录管理后台'}
});

$("#togglePassword").addEventListener("click",()=>{const input=$("#loginPassword"),button=$("#togglePassword"),show=input.type==="password";input.type=show?"text":"password";button.textContent=show?"隐藏":"显示";button.setAttribute("aria-label",show?"隐藏密码":"显示密码");button.setAttribute("aria-pressed",String(show));});

$("#logoutBtn").addEventListener("click",()=>{localStorage.removeItem(TOKEN_KEY);document.body.classList.remove("authenticated");$("#loginPassword").value="";});
function showPage(name){if(!pageNames[name])return;document.querySelectorAll(".page").forEach(el=>{const active=el.id==="page-"+name;el.classList.toggle("active",active);el.setAttribute("aria-hidden",String(!active))});document.querySelectorAll(".nav-item").forEach(el=>{const active=el.dataset.page===name;el.classList.toggle("active",active);if(active)el.setAttribute("aria-current","page");else el.removeAttribute("aria-current")});$("#pageCrumb").textContent=pageNames[name];$("#sidebar").classList.remove("open");$("#menuToggle").setAttribute("aria-expanded","false");window.scrollTo({top:0,behavior:"smooth"});const loaders={overview:loadOverview,orders:loadOrders,users:loadUsers,products:loadProducts,nodes:loadNodes,support:loadSupport,email:loadEmail,notices:loadNotices,upstream:refreshUpstream,payments:loadPayments,bots:loadBots};if(loaders[name])loaders[name]();}
document.querySelectorAll(".nav-item").forEach(btn=>btn.addEventListener("click",()=>showPage(btn.dataset.page)));
document.querySelectorAll("[data-go]").forEach(btn=>btn.addEventListener("click",()=>{showPage(btn.dataset.go);if(btn.dataset.productTab)switchProductTab(btn.dataset.productTab);if(btn.dataset.nodeTab)switchNodeTab(btn.dataset.nodeTab)}));
$("#menuToggle").addEventListener("click",()=>{const open=$("#sidebar").classList.toggle("open");$("#menuToggle").setAttribute("aria-expanded",String(open))});
$("#refreshBtn").addEventListener("click",async()=>{await Promise.allSettled([checkApi(),loadOverview()]);toast("经营数据已刷新")});
async function checkApi(){const dot=$("#apiDot"),status=$("#apiStatus");dot.parentElement.classList.remove("ok","bad");status.textContent="正在检查 API";try{const r=await fetchWithTimeout(API_BASE+"/health",{cache:"no-store"},8000);if(!r.ok)throw Error();const d=await r.json();if(!d.ok)throw Error();dot.parentElement.classList.add("ok");status.textContent="API 正常"}catch{dot.parentElement.classList.add("bad");status.textContent="API 暂不可用"}}
document.querySelectorAll("[data-amount]").forEach(btn=>btn.addEventListener("click",()=>{$("#creditAmount").value=btn.dataset.amount}));
$("#creditForm").addEventListener("submit",async e=>{e.preventDefault();const email=$("#creditEmail").value.trim().toLowerCase(),amount=$("#creditAmount").value.trim(),result=$("#creditResult"),submit=$("#creditSubmit");result.className="form-result";result.textContent="";if(!/^\d{1,8}(\.\d{1,2})?$/.test(amount)||Number(amount)<=0){result.classList.add("error");result.textContent="请输入有效人民币金额，最多两位小数。";return}const amountCny=Number(amount),amountUsdt=(amountCny/4).toFixed(4);if(!confirm("确认向 "+email+" 充值 ¥"+amountCny.toFixed(2)+"？系统按 ¥4.00 = 1 USDT 折算入账。此操作会真实增加用户余额。"))return;submit.disabled=true;submit.textContent="正在提交…";try{await adminRequest("/api/admin/credit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,amount_usdt:amountUsdt})});result.classList.add("success");result.textContent="充值成功。用户："+email+" · 人民币金额：¥"+amountCny.toFixed(2);$("#creditAmount").value="";toast("余额充值成功")}catch(error){result.classList.add("error");result.textContent=error.message||"请求失败"}finally{submit.disabled=false;submit.innerHTML="确认充值"}});


function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,ch=>{if(ch==="&")return "&amp;";if(ch==="<")return "&lt;";if(ch===">")return "&gt;";if(ch==='"')return "&quot;";return "&#39;"})}
function formatAdminDate(value){
 if(value===null||value===undefined||value==="")return "—";
 const n=Number(value),d=Number.isFinite(n)&&String(value).trim()!==""?new Date(n<1000000000000?n*1000:n):new Date(value);
 return Number.isNaN(d.getTime())?"—":d.toLocaleString("zh-CN",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
}
function statusText(status){return ({pending:"待处理",reserved:"已预留",delivered:"已交付",refunded:"已退款",failed:"失败",processing:"处理中",paid:"已支付",cancelled:"已取消",expired:"已过期",provisioning:"配置中",active:"可用",inactive:"已停用",available:"可售",sold:"已售",completed:"已完成",started:"处理中",unknown:"待核对"})[String(status||"").toLowerCase()]||String(status||"未知")}
function statusPill(status){const value=String(status||"").toLowerCase();const cls=["delivered","paid","active"].includes(value)?"good":["failed","refunded","cancelled","expired","inactive"].includes(value)?"bad":"wait";return '<span class="status-pill '+cls+'">'+escapeHtml(statusText(value))+'</span>'}
function unwrapLegacy(value){let v=value;for(let i=0;i<4;i++){if(!v||typeof v!=="object"||Array.isArray(v)||!Object.prototype.hasOwnProperty.call(v,"data"))break;if(v.ok===true||v.code!==undefined||v.status==="success")v=v.data;else break;}return v}
async function legacyAdmin(path,options={}){return unwrapLegacy(await adminRequest("/api/admin/legacy"+path,options))}
function dataList(value){const v=unwrapLegacy(value);if(Array.isArray(v))return v;if(!v||typeof v!=="object")return [];return v.list||v.items||v.products||v.orders||v.users||v.rows||v.records||[]}
function dataTotal(value,list){return Number(value?.total??value?.count??value?.total_count??list.length)}
function cnyValue(value){const n=Number(value);return Number.isFinite(n)?n:0}
function formatCny(value){return "¥"+cnyValue(value).toFixed(2)}
function orderStatusLabel(value){const n=Number(value);if(Number.isFinite(n)&&String(value).trim()!=="")return ({0:"待支付",1:"待发货",2:"已发货",3:"已完成","-1":"已取消"})[n]||String(value);return statusText(value)}
async function loadPayments(){
 const body=$("#paymentStatsBody");if(!body)return;body.innerHTML='<tr><td colspan="3" class="table-empty">正在读取支付配置和收款记录…</td></tr>';
 try{
  const d=await legacyAdmin("/payment_configs?view=status"),channels=d.channels||[];
  channels.forEach(ch=>{
   const card=document.querySelector('[data-payment-card="'+ch.channel+'"]');if(!card)return;
   const ready=!!ch.configured&&!!ch.enabled;
   const status=ready?"已开通":ch.configured?"已配置 / 停用":"待绑定";
   const tag=card.querySelector("[data-payment-status]");tag.textContent=status;tag.className="tag "+(ready?"tag-green":"");
   card.querySelector("[data-payment-detail]").textContent=ch.detail||"暂无说明";
   const enabled=card.querySelector("[data-payment-enabled]");if(enabled)enabled.textContent=ch.enabled?"已启用":"未启用";
   const updated=card.querySelector("[data-payment-updated]");if(updated)updated.textContent=ch.updated_at?formatAdminDate(ch.updated_at):"尚未配置";
   if(ch.channel==="usdt"){
    card.querySelector("[data-payment-network]").textContent=ch.network||"—";
    card.querySelector("[data-payment-address]").textContent=ch.address_masked||"未配置";
    card.querySelector("[data-payment-rate]").textContent=ch.rate?"¥"+Number(ch.rate).toFixed(2)+" / USDT":"—";
   }
  });
  const names={alipay:"支付宝",wechat:"微信支付",usdt:"USDT",mtp_bind:"MTProto 绑定",other:"其他"};
  const stats=d.paid_orders||{},rows=["alipay","wechat","usdt","mtp_bind"].map(k=>[k,stats[k]||{orders:0,amount_cny:0}]);
  body.innerHTML=rows.map(([k,v])=>'<tr><td>'+escapeHtml(names[k]||k)+'</td><td>'+Number(v.orders||0).toLocaleString("zh-CN")+'</td><td class="money">'+formatCny(v.amount_cny||0)+'</td></tr>').join("");
  $("#paymentStatsUpdated").textContent="刷新于 "+new Date().toLocaleTimeString("zh-CN");
 }catch(e){body.innerHTML='<tr><td colspan="3" class="table-empty error-text">读取支付状态失败：'+escapeHtml(e.message||"接口不可用")+'</td></tr>'}
}
$("#paymentsRefresh")?.addEventListener("click",loadPayments);
async function loadOverview(){
 const jobs=await Promise.allSettled([
  legacyAdmin("/shop/overview"),
  legacyAdmin("/stats/overview"),
  legacyAdmin("/account_pool/stats"),
  legacyAdmin("/tickets?status=1&page=1&size=1"),
  legacyAdmin("/nodes"),
  legacyAdmin("/plans"),
  legacyAdmin("/shop/orders?page=1&size=6"),
  legacyAdmin("/shop/products?page=1&size=100"),
  legacyAdmin("/notices"),
  legacyAdmin("/config/mail"),
  adminRequest("/api/admin/bots")
 ]);
 const val=i=>jobs[i].status==="fulfilled"?jobs[i].value:null;
 const shop=val(0)||{},stats=val(1)||{},accounts=val(2)||{},tickets=val(3)||{},nodes=dataList(val(4)),plans=dataList(val(5)),ordersData=val(6)||{},productsData=val(7)||{};
 const orders=dataList(ordersData),products=dataList(productsData),notices=dataList(val(8)),mail=val(9)||{},bots=val(10)?.bots||[];
 const userTotal=Number(stats.users_total??0);
 const orderTotal=Number(shop.orders_pending||0)+Number(shop.orders_toship||0)+Number(shop.orders_shipped||0)+Number(shop.orders_done||0);
 const productTotal=Number(shop.products_online??shop.products_total??productsData.total??products.length);
 const stockTotal=Number(shop.stock_total??shop.total_stock??products.reduce((n,p)=>n+Number(p.stock||0),0));
 const revenue=Number(stats.income_total??shop.today_amount??0);
 const pendingOrders=Number(shop.orders_pending??0)+Number(shop.orders_toship??0);
 const available=Number(accounts.available??accounts.in_stock??0),sold=Number(accounts.sold??0);
 const pendingSupport=Number(tickets.total??dataList(tickets).length??0);
 const lowStock=products.filter(p=>Number(p.stock||0)<=5&&Number(p.status??p.is_active??1)!==0).length;
 $("#metricRevenue").textContent=formatCny(revenue);
 $("#metricOrders").textContent=orderTotal.toLocaleString("zh-CN");
 $("#metricNodeOrders").textContent=Number(stats.orders_total??0).toLocaleString("zh-CN");
 $("#metricPendingOrders").textContent="待处理 "+pendingOrders.toLocaleString("zh-CN");
 $("#metricUsers").textContent=userTotal.toLocaleString("zh-CN");
 $("#metricProducts").textContent=productTotal.toLocaleString("zh-CN");
 $("#metricStock").textContent="商品库存 "+stockTotal.toLocaleString("zh-CN");
 $("#metricInventory").textContent=available.toLocaleString("zh-CN");
 $("#metricSoldInventory").textContent="已售 "+sold.toLocaleString("zh-CN");
 $("#metricTickets").textContent=pendingSupport.toLocaleString("zh-CN");
 $("#metricNodes").textContent=nodes.length.toLocaleString("zh-CN");
 $("#metricPlans").textContent="节点套餐 "+plans.length.toLocaleString("zh-CN");
 $("#metricNotices").textContent=notices.filter(n=>Number(n.status)===1).length.toLocaleString("zh-CN");
 $("#metricEmail").textContent=mail.smtp_host&&mail.sender_email?"已配置":"待配置";
 $("#metricBots").textContent=bots.filter(b=>b.status==="active").length+" / "+(bots.length||3);
 $("#todoOrders").textContent=pendingOrders.toLocaleString("zh-CN");
 $("#todoSupport").textContent=pendingSupport.toLocaleString("zh-CN");
 $("#todoLowStock").textContent=lowStock.toLocaleString("zh-CN");
 $("#todoNodes").textContent=nodes.length+" 条线路 / "+plans.length+" 个套餐";
 const body=$("#overviewOrdersBody");
 body.innerHTML=orders.length?orders.slice(0,6).map(o=>'<tr><td class="mono">'+escapeHtml(o.trade_no||o.order_no||o.order_id||o.id||"—")+'</td><td>'+escapeHtml(o.user_email||o.email||o.customer_email||"—")+'</td><td>'+escapeHtml(o.product_title||o.title||o.product_name||o.product_id||"—")+'</td><td class="money">'+formatCny(o.total_amount??o.amount??o.total??0)+'</td><td>'+statusPill(orderStatusLabel(o.status))+'</td><td>'+escapeHtml(formatAdminDate(o.created_at))+'</td></tr>').join(""):'<tr><td colspan="6" class="table-empty">暂无订单或订单接口暂不可用</td></tr>';
 const failed=jobs.map((x,i)=>x.status==="rejected"?i:-1).filter(i=>i>=0);
 if(failed.length)$("#apiStatus").textContent="部分业务数据待接通";
}
async function loadUsers(){
 const body=$("#usersBody");if(!body)return;body.innerHTML='<tr><td colspan="8" class="table-empty">正在读取用户数据…</td></tr>';
 const q=$("#userSearch")?.value.trim()||"";
 try{
  const data=await legacyAdmin("/users");
  const all=dataList(data),users=all.filter(u=>!q||[u.email,u.nickname,u.short_id,u.tg_id,u.tg_username,u.last_login_ip].some(v=>String(v||"").toLowerCase().includes(q.toLowerCase()))).slice(0,50);
  body.innerHTML=users.length?users.map(user=>'<tr><td><b>'+escapeHtml(user.email||"—")+'</b></td><td>'+escapeHtml(user.nickname||user.name||"—")+'</td><td class="mono">'+escapeHtml(user.tg_username||user.tg_id||user.short_id||"—")+'</td><td class="money">'+formatCny(Number(user.commission_balance||0)/100)+'</td><td>'+escapeHtml(formatAdminDate(user.created_at))+'</td><td class="mono">'+escapeHtml(user.last_login_ip||"—")+'</td><td>'+escapeHtml(formatAdminDate(user.last_login_at))+'</td><td><button class="btn btn-secondary btn-small" data-user-detail="'+Number(user.id||0)+'">详情</button></td></tr>').join(""):'<tr><td colspan="8" class="table-empty">没有找到匹配用户</td></tr>';
  $("#usersCount").textContent="全站用户 "+all.length.toLocaleString("zh-CN")+" 位（当前显示 "+users.length+" 位）";
  body.querySelectorAll("[data-user-detail]").forEach(btn=>btn.addEventListener("click",()=>openUserDetail(Number(btn.dataset.userDetail))));
 }catch(error){body.innerHTML='<tr><td colspan="8" class="table-empty error-text">读取失败：'+escapeHtml(error.message||"请求失败")+'</td></tr>';$("#usersCount").textContent="读取失败"}
}
async function openUserDetail(id){
 const modal=$("#userDetailModal");modal.hidden=false;$("#userDetailTitle").textContent="客户 #"+id;$("#userDetailMeta").textContent="正在读取用户资料…";$("#userDetailSummary").innerHTML='<div class="empty-state">读取中…</div>';$("#userLoginHistory").innerHTML='<tr><td colspan="3" class="table-empty">读取中…</td></tr>';$("#userOrdersHistory").innerHTML='<tr><td colspan="4" class="table-empty">读取中…</td></tr>';$("#userDetailResult").textContent="";
 try{
  const raw=await legacyAdmin("/users/detail?id="+encodeURIComponent(id)),u=raw?.user||raw;
  $("#userDetailTitle").textContent=u.email||("客户 #"+id);$("#userDetailMeta").textContent="用户 ID "+id+" · "+(Number(u.banned)?"已封禁":"正常");
  const used=Number(u.u||0)+Number(u.d||0),traffic=Number(u.transfer_enable||0);
  const items=[["注册邮箱",u.email||"—"],["首次记录 IP",u.first_login_ip||"暂无登录记录"],["最近登录 IP",u.last_login_ip||"—"],["登录次数",Number(u.login_count||0).toLocaleString("zh-CN")],["注册时间",formatAdminDate(u.created_at)],["最近登录",formatAdminDate(u.last_login_at)],["佣金余额",formatCny(Number(u.commission_balance||0)/100)],["累计佣金",formatCny(Number(u.commission_total||0)/100)],["套餐 ID",u.plan_id??"—"],["到期时间",formatAdminDate(u.expired_at)],["流量使用",((used/1073741824)||0).toFixed(2)+" GB"],["流量上限",traffic?((traffic/1073741824).toFixed(2)+" GB"):"不限/未设置"]];
  $("#userDetailSummary").innerHTML=items.map(x=>'<div class="user-detail-item"><small>'+escapeHtml(x[0])+'</small><b>'+escapeHtml(String(x[1]))+'</b></div>').join("");
  const logs=u.login_history||[];
  $("#userLoginHistory").innerHTML=logs.length?logs.map(x=>'<tr><td class="mono">'+escapeHtml(x.ip||"—")+'</td><td>'+escapeHtml((x.ua||"—").slice(0,100))+'</td><td>'+escapeHtml(formatAdminDate(x.created_at))+'</td></tr>').join(""):'<tr><td colspan="3" class="table-empty">暂无登录历史</td></tr>';
  const orders=u.orders||[];
  $("#userOrdersHistory").innerHTML=orders.length?orders.map(x=>'<tr><td class="mono">'+escapeHtml(x.trade_no||"—")+'</td><td class="money">'+formatCny(Number(x.total_amount||0)/100)+'</td><td>'+escapeHtml(({alipay:"支付宝",wechat:"微信支付",usdt:"USDT"})[x.method]||x.method||"—")+'</td><td>'+statusPill(orderStatusLabel(x.status))+'</td></tr>').join(""):'<tr><td colspan="4" class="table-empty">暂无订单</td></tr>';
 }catch(e){$("#userDetailMeta").textContent="读取失败";$("#userDetailSummary").innerHTML='<div class="table-empty error-text">'+escapeHtml(e.message||"读取用户详情失败")+'</div>'}
}
$("#userDetailClose")?.addEventListener("click",()=>$("#userDetailModal").hidden=true);

async function loadOrders(){
 const body=$("#ordersBody");if(!body)return;body.innerHTML='<tr><td colspan="8" class="table-empty">正在读取订单数据…</td></tr>';
 const q=$("#orderSearch")?.value.trim()||"",status=$("#orderStatus")?.value||"";
 try{
  const data=await legacyAdmin("/shop/orders?trade_no="+encodeURIComponent(q)+"&status="+encodeURIComponent(status)+"&page=1&size=50");
  const orders=dataList(data);
  body.innerHTML=orders.length?orders.map(order=>'<tr><td class="mono">'+escapeHtml(order.trade_no||order.order_no||order.id||"—")+'</td><td>'+escapeHtml(order.delivery_type===1?"数字商品":order.order_type||"商城订单")+'</td><td>'+escapeHtml(order.user_email||order.email||order.user_id||"—")+'</td><td class="mono">'+escapeHtml(order.product_title||order.title||order.product_id||"—")+'</td><td class="money">'+formatCny(order.total_amount??order.amount??order.total??0)+'</td><td>'+statusPill(orderStatusLabel(order.status))+'</td><td>'+escapeHtml(formatAdminDate(order.created_at))+'</td><td><button class="btn btn-secondary btn-small" data-order-detail="'+escapeHtml(order.trade_no||order.order_no||order.id||"")+'">详情</button></td></tr>').join(""):'<tr><td colspan="8" class="table-empty">暂无符合条件的订单</td></tr>';
  $("#ordersCount").textContent="全站订单 "+dataTotal(data,orders).toLocaleString("zh-CN")+" 条";
  body.querySelectorAll("[data-order-detail]").forEach(btn=>btn.addEventListener("click",()=>openOrderDetail(btn.dataset.orderDetail)));
 }catch(error){body.innerHTML='<tr><td colspan="8" class="table-empty error-text">读取失败：'+escapeHtml(error.message||"请求失败")+'</td></tr>';$("#ordersCount").textContent="读取失败"}
}
async function loadProducts(){
 const body=$("#productsBody");if(!body)return;body.innerHTML='<tr><td colspan="7" class="table-empty">正在读取商品目录…</td></tr>';
 const q=$("#productSearch")?.value.trim()||"";
 try{
  const data=await legacyAdmin("/shop/products?kw="+encodeURIComponent(q)+"&page=1&size=100");
  const products=dataList(data);
  body.innerHTML=products.length?products.map(p=>'<tr><td><b>'+escapeHtml(p.title||p.name||"未命名商品")+'</b><small class="muted-inline">#'+escapeHtml(p.id)+'</small></td><td>'+escapeHtml(p.category||"—")+'</td><td class="money">'+formatCny(p.price)+'</td><td class="money">'+formatCny(p.cost)+'</td><td>'+Number(p.stock||0).toLocaleString("zh-CN")+'</td><td>'+statusPill(Number(p.status??p.is_active??0)?"active":"inactive")+'</td><td><div class="table-actions"><button class="btn btn-secondary btn-small" data-product-edit="'+escapeHtml(p.id)+'">编辑</button><button class="btn btn-secondary btn-small" data-product-toggle="'+escapeHtml(p.id)+'" data-status="'+(Number(p.status??p.is_active??0)?0:1)+'">'+(Number(p.status??p.is_active??0)?"下架":"上架")+'</button><button class="btn btn-danger btn-small" data-product-delete="'+escapeHtml(p.id)+'">删除</button></div></td></tr>').join(""):'<tr><td colspan="7" class="table-empty">暂无商品，请新增商品或检查数据接口</td></tr>';
  $("#productsCount").textContent="共 "+dataTotal(data,products).toLocaleString("zh-CN")+" 件商品";
  body.querySelectorAll("[data-product-edit]").forEach(btn=>btn.addEventListener("click",()=>{const p=products.find(x=>String(x.id)===btn.dataset.productEdit);if(p)editProduct(p)}));
  body.querySelectorAll("[data-product-toggle]").forEach(btn=>btn.addEventListener("click",async()=>{btn.disabled=true;try{await legacyAdmin("/shop/product/status",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:Number(btn.dataset.productToggle),status:Number(btn.dataset.status)})});toast("商品状态已更新");await loadProducts()}catch(e){toast("更新失败："+e.message)}finally{btn.disabled=false}}));
  body.querySelectorAll("[data-product-delete]").forEach(btn=>btn.addEventListener("click",async()=>{if(!confirm("确定删除这件商品？删除后不会影响已完成订单。"))return;btn.disabled=true;try{await legacyAdmin("/shop/product/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:Number(btn.dataset.productDelete)})});toast("商品已删除");await loadProducts()}catch(e){toast("删除失败："+e.message)}finally{btn.disabled=false}}));
 }catch(error){body.innerHTML='<tr><td colspan="7" class="table-empty error-text">读取失败：'+escapeHtml(error.message||"请求失败")+'</td></tr>';$("#productsCount").textContent="读取失败"}
}


let activeOrder=null,activePurchaseText="";
async function openOrderDetail(tradeNo){
 const modal=$("#orderModal");modal.hidden=false;$("#orderModalTitle").textContent="订单 "+tradeNo;$("#orderModalMeta").textContent="正在读取订单详情…";$("#orderModalContent").textContent="正在读取订单商品、客户和物流信息…";$("#orderModalResult").textContent="";$("#orderDeliveryContent").value="";activeOrder=null;activePurchaseText="";
 try{
  const d=await legacyAdmin("/shop/order/detail?trade_no="+encodeURIComponent(tradeNo));activeOrder=d;
  const items=d.items||[];
  $("#orderModalMeta").textContent=(d.user_email||"客户信息未记录")+" · "+orderStatusLabel(d.status);
  $("#orderModalContent").textContent=[
   "订单号："+(d.trade_no||tradeNo),
   "客户："+(d.user_email||d.user_id||"—"),
   "订单金额："+formatCny(d.total_amount??d.amount??0),
   "订单状态："+orderStatusLabel(d.status),
   "创建时间："+formatAdminDate(d.created_at),
   "收件人："+(d.receiver_name||"—"),
   "联系电话："+(d.receiver_phone||"—"),
   "收货地址："+(d.receiver_address||"—"),
   "物流公司："+(d.tracking_company||"—"),
   "物流单号："+(d.tracking_no||"—"),
   "",
   "商品明细：",
   ...items.map(x=>"· "+(x.title||("商品 #"+x.product_id))+" × "+Number(x.qty||1)+" / "+formatCny(x.price))
  ].join(String.fromCharCode(10));
  $("#orderModalStatus").value=String(d.status??0);$("#orderTrackingCompany").value=d.tracking_company||"";$("#orderTrackingNo").value=d.tracking_no||"";
  try{const p=await legacyAdmin("/shop/order/purchase?trade_no="+encodeURIComponent(tradeNo));activePurchaseText=p.text||""}catch{}
 }catch(e){$("#orderModalContent").textContent="读取失败："+(e.message||"接口错误")}
}
$("#orderModalClose")?.addEventListener("click",()=>$("#orderModal").hidden=true);
$("#orderStatusSave")?.addEventListener("click",async()=>{if(!activeOrder)return;const status=Number($("#orderModalStatus").value);if(!confirm("确认将订单状态更新为「"+orderStatusLabel(status)+"」？"))return;try{await legacyAdmin("/shop/order/status",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({trade_no:activeOrder.trade_no,status})});toast("订单状态已更新");$("#orderModal").hidden=true;loadOrders()}catch(e){$("#orderModalResult").textContent=e.message||"更新失败"}});
$("#orderDeliverBtn")?.addEventListener("click",async()=>{
 if(!activeOrder)return;
 const content=$("#orderDeliveryContent").value.trim();
 if(!content){$("#orderModalResult").textContent="请先粘贴本订单的账号、卡密或授权内容";return}
 const overwrite=$("#orderDeliveryOverwrite").value==="1";
 if(!confirm("确认向订单 "+activeOrder.trade_no+" 写入交付内容？\n系统只允许已付款订单交付。"+(overwrite?"\n注意：本次允许覆盖已有交付内容。":"\n已有不同交付内容时将拒绝覆盖。")))return;
 const btn=$("#orderDeliverBtn");btn.disabled=true;$("#orderModalResult").textContent="正在安全写入订单交付记录…";
 try{
  const d=await legacyAdmin("/shop/order/deliver",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({trade_no:activeOrder.trade_no,delivery_content:content,delivery_type:$("#orderDeliveryType").value,overwrite})});
  $("#orderDeliveryContent").value="";$("#orderModalResult").textContent=d.message||"交付内容已写入";toast("订单交付成功，客户可在订单详情查看");await openOrderDetail(activeOrder.trade_no);await loadOrders()
 }catch(e){$("#orderModalResult").textContent=e.message||"交付失败";toast("交付失败："+(e.message||"请检查订单状态"))}
 finally{btn.disabled=false}
});
$("#orderShipBtn")?.addEventListener("click",async()=>{if(!activeOrder)return;const tracking_no=$("#orderTrackingNo").value.trim();if(!tracking_no){$("#orderModalResult").textContent="请先填写物流单号";return}if(!confirm("确认发货并将订单状态改为已发货？"))return;try{await legacyAdmin("/shop/order/ship",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({trade_no:activeOrder.trade_no,tracking_no,tracking_company:$("#orderTrackingCompany").value.trim()})});toast("订单已发货");$("#orderModal").hidden=true;loadOrders()}catch(e){$("#orderModalResult").textContent=e.message||"发货失败"}});
$("#orderPurchaseCopy")?.addEventListener("click",async()=>{if(!activePurchaseText){toast("该订单暂无可复制的采购信息");return}try{await navigator.clipboard.writeText(activePurchaseText);toast("采购信息已复制")}catch{const t=document.createElement("textarea");t.value=activePurchaseText;document.body.appendChild(t);t.select();try{document.execCommand("copy");toast("采购信息已复制")}catch{toast("复制失败，请手动查看")};t.remove()}});
$("#ordersRefresh")?.addEventListener("click",loadOrders);
$("#orderSearchBtn")?.addEventListener("click",loadOrders);
$("#orderStatus")?.addEventListener("change",loadOrders);
$("#usersRefresh")?.addEventListener("click",loadUsers);
$("#userSearchBtn")?.addEventListener("click",loadUsers);
$("#userSearch")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();loadUsers()}});
$("#productsRefresh")?.addEventListener("click",loadProducts);
$("#productSearchBtn")?.addEventListener("click",loadProducts);
$("#productSearch")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();loadProducts()}});


function switchProductTab(tab){
 document.querySelectorAll("[data-product-tab]").forEach(b=>b.classList.toggle("active",b.dataset.productTab===tab));
 document.querySelectorAll(".product-view").forEach(v=>v.classList.toggle("active",v.id==="productView-"+tab));
 if(tab==="accounts")loadAccountPool();else loadProducts();
}
function switchNodeTab(tab){
 document.querySelectorAll("[data-node-tab]").forEach(b=>b.classList.toggle("active",b.dataset.nodeTab===tab));
 document.querySelectorAll(".node-view").forEach(v=>v.classList.toggle("active",v.id==="nodeView-"+tab));
 if(tab==="servers")loadNodeServers();else if(tab==="protocols")loadProtocolNodes();else if(tab==="orders")loadNodeOrders();else loadPlans();
}
document.querySelectorAll("[data-product-tab]").forEach(b=>b.addEventListener("click",()=>switchProductTab(b.dataset.productTab)));
document.querySelectorAll("[data-node-tab]").forEach(b=>b.addEventListener("click",()=>switchNodeTab(b.dataset.nodeTab)));
function editProduct(p){
 $("#productId").value=p.id||"";$("#productTitle").value=p.title||p.name||"";$("#productCategory").value=p.category||"";
 $("#productPrice").value=p.price??"";$("#productCost").value=p.cost??"";$("#productStock").value=p.stock??0;$("#productSort").value=p.sort??0;
 $("#productImage").value=p.image||"";$("#productSubtitle").value=p.subtitle||"";$("#productDetail").value=p.detail||p.description||"";
 $("#productStatus").value=String(p.status??1);$("#productFormTitle").textContent=p.id?"编辑商品":"新增商品";
 $("#productFormPanel").hidden=false;$("#productFormPanel").scrollIntoView({behavior:"smooth",block:"start"});
}
$("#productAddBtn")?.addEventListener("click",()=>{editProduct({});$("#productFormResult").textContent=""});
$("#productFormClose")?.addEventListener("click",()=>{$("#productFormPanel").hidden=true});
$("#productForm")?.addEventListener("submit",async e=>{
 e.preventDefault();const btn=$("#productSaveBtn"),result=$("#productFormResult");
 const payload={id:Number($("#productId").value)||undefined,title:$("#productTitle").value.trim(),name:$("#productTitle").value.trim(),category:$("#productCategory").value.trim(),price:Number($("#productPrice").value),cost:Number($("#productCost").value||0),stock:Number($("#productStock").value),sort:Number($("#productSort").value||0),image:$("#productImage").value.trim(),subtitle:$("#productSubtitle").value.trim(),detail:$("#productDetail").value.trim(),description:$("#productDetail").value.trim(),status:Number($("#productStatus").value)};
 if(!payload.title||!payload.category||!Number.isFinite(payload.price)||payload.price<0||payload.stock<0){result.textContent="请检查商品名称、分类、价格和库存";result.className="form-result error";return}
 btn.disabled=true;result.textContent="正在保存…";
 try{await legacyAdmin("/shop/product/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});result.className="form-result success";result.textContent="商品已保存";toast("商品保存成功");$("#productFormPanel").hidden=true;await loadProducts()}
 catch(error){result.className="form-result error";result.textContent=error.message||"保存失败"}
 finally{btn.disabled=false}
});
async function loadAccountPool(){
 const body=$("#accountPoolBody");if(!body)return;body.innerHTML='<tr><td colspan="6" class="table-empty">正在读取账号库存…</td></tr>';
 const status=$("#accountPoolStatus")?.value||"";
 const [sr,lr]=await Promise.allSettled([legacyAdmin("/account_pool/stats"),legacyAdmin("/account_pool?status="+encodeURIComponent(status)+"&page=1&size=50")]);
 if(sr.status==="fulfilled"){const st=sr.value||{};const available=Number(st.available||0),sold=Number(st.sold||0);$("#accountAvailableCount").textContent=available.toLocaleString("zh-CN");$("#accountSoldCount").textContent=sold.toLocaleString("zh-CN");$("#accountTotalCount").textContent=(available+sold).toLocaleString("zh-CN")}
 if(lr.status!=="fulfilled"){body.innerHTML='<tr><td colspan="6" class="table-empty error-text">库存读取失败：'+escapeHtml(lr.reason?.message||"接口错误")+'</td></tr>';return}
 const d=lr.value||{},items=d.items||dataList(d);
 body.innerHTML=items.length?items.map(x=>'<tr><td><b>'+escapeHtml(x.email||x.session_id||"—")+'</b></td><td>'+escapeHtml(x.phone||"—")+'</td><td>'+statusPill(x.status==="available"?"active":x.status)+'</td><td class="mono">'+escapeHtml(x.order_id||"—")+'</td><td>'+escapeHtml(formatAdminDate(x.created_at))+'</td><td><div class="table-actions">'+(x.status==="sold"?'<button class="btn btn-secondary btn-small" data-account-restore="'+x.id+'">恢复可售</button>':'')+'<button class="btn btn-danger btn-small" data-account-delete="'+x.id+'">删除</button></div></td></tr>').join(""):'<tr><td colspan="6" class="table-empty">当前筛选下没有账号库存</td></tr>';
 $("#accountPoolCount").textContent="共 "+Number(d.total??items.length).toLocaleString("zh-CN")+" 条账号库存";
 body.querySelectorAll("[data-account-restore]").forEach(b=>b.addEventListener("click",async()=>{b.disabled=true;try{await legacyAdmin("/account_pool/restore",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:Number(b.dataset.accountRestore)})});toast("账号已恢复为可售");loadAccountPool()}catch(e){toast("操作失败："+e.message)}finally{b.disabled=false}}));
 body.querySelectorAll("[data-account-delete]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("确认删除这条库存记录？"))return;b.disabled=true;try{await legacyAdmin("/account_pool/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:Number(b.dataset.accountDelete)})});toast("库存记录已删除");loadAccountPool()}catch(e){toast("删除失败："+e.message)}finally{b.disabled=false}}));
}
$("#accountPoolRefresh")?.addEventListener("click",loadAccountPool);$("#accountPoolStatus")?.addEventListener("change",loadAccountPool);
$("#accountImportFile")?.addEventListener("change",async e=>{const f=e.target.files?.[0];if(!f)return;$("#accountImportText").value=await f.text();toast("文件已载入，请检查格式后导入")});
$("#accountImportForm")?.addEventListener("submit",async e=>{
 e.preventDefault();const textValue=$("#accountImportText").value.trim(),result=$("#accountImportResult"),btn=$("#accountImportSubmit");
 if(!textValue){result.className="form-result error";result.textContent="请先选择文件或粘贴账号数据";return}
 const count=textValue.split(/\r?\n/).filter(x=>x.trim()).length;
 if(!confirm("即将导入 "+count+" 行账号资料。重复邮箱会自动跳过，原库存不会覆盖。确认继续？"))return;
 btn.disabled=true;result.className="form-result";result.textContent="正在安全写入库存…";
 try{const d=await legacyAdmin("/account_pool/bulk",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:textValue})});result.className="form-result success";result.textContent=d.message||("新增 "+(d.inserted||0)+" 条，跳过 "+(d.skipped||0)+" 条");$("#accountImportText").value="";$("#accountImportFile").value="";toast("账号库存导入完成");await loadAccountPool()}
 catch(error){result.className="form-result error";result.textContent=error.message||"导入失败"}
 finally{btn.disabled=false}
});
async function loadPlans(){
 const body=$("#plansBody");if(!body)return;body.innerHTML='<tr><td colspan="9" class="table-empty">正在读取节点套餐…</td></tr>';
 try{const d=await legacyAdmin("/plans"),plans=dataList(d);body.innerHTML=plans.length?plans.map(p=>'<tr><td><b>'+escapeHtml(p.name||"未命名套餐")+'</b><small class="muted-inline">'+escapeHtml(p.tagline||p.type||"")+'</small></td><td>'+escapeHtml(p.region_name||p.region||"—")+'</td><td class="money">'+formatCny(Number(p.month_price||0)/100)+'</td><td class="money">'+formatCny(Number(p.quarter_price||0)/100)+'</td><td class="money">'+formatCny(Number(p.half_year_price||0)/100)+'</td><td class="money">'+formatCny(Number(p.year_price||0)/100)+'</td><td>'+Number(p.transfer_enable||0)+' GB</td><td>'+statusPill(Number(p.show)?"active":"inactive")+'</td><td><div class="table-actions"><button class="btn btn-secondary btn-small" data-plan-edit="'+p.id+'">编辑</button><button class="btn btn-danger btn-small" data-plan-delete="'+p.id+'">删除</button></div></td></tr>').join(""):'<tr><td colspan="9" class="table-empty">暂无节点套餐</td></tr>';$("#plansCount").textContent="共 "+plans.length+" 个套餐";body.querySelectorAll("[data-plan-edit]").forEach(b=>b.addEventListener("click",()=>{const p=plans.find(x=>String(x.id)===b.dataset.planEdit);if(p)editPlan(p)}));body.querySelectorAll("[data-plan-delete]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("确认删除这个套餐？"))return;try{await legacyAdmin("/plans/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:Number(b.dataset.planDelete)})});toast("套餐已删除");loadPlans()}catch(e){toast("删除失败："+e.message)}}))}
 catch(e){body.innerHTML='<tr><td colspan="9" class="table-empty error-text">读取套餐失败：'+escapeHtml(e.message||"接口错误")+'</td></tr>'}
}
function editPlan(p){$("#planId").value=p.id||"";$("#planName").value=p.name||"";$("#planType").value=p.type||"node";$("#planMonthPrice").value=(Number(p.month_price||0)/100).toFixed(2);$("#planQuarterPrice").value=(Number(p.quarter_price||0)/100).toFixed(2);$("#planHalfPrice").value=(Number(p.half_year_price||0)/100).toFixed(2);$("#planYearPrice").value=(Number(p.year_price||0)/100).toFixed(2);$("#planTraffic").value=(Number(p.transfer_enable||0)/1073741824).toFixed(2);$("#planSpeed").value=p.speed||"";$("#planRegion").value=p.region||"";$("#planRegionName").value=p.region_name||"";$("#planContent").value=p.content||"";$("#planShow").value=String(p.show??1);$("#planHot").value=String(p.hot??0);$("#planFormTitle").textContent=p.id?"编辑节点套餐":"新增节点套餐";$("#planFormPanel").hidden=false;$("#planFormPanel").scrollIntoView({behavior:"smooth",block:"start"})}
$("#planAddBtn")?.addEventListener("click",()=>editPlan({}));$("#planFormClose")?.addEventListener("click",()=>$("#planFormPanel").hidden=true);
$("#planForm")?.addEventListener("submit",async e=>{e.preventDefault();const btn=$("#planSaveBtn"),res=$("#planFormResult");btn.disabled=true;res.textContent="正在保存…";const p={id:Number($("#planId").value)||undefined,name:$("#planName").value.trim(),type:$("#planType").value.trim(),month_price:Math.round(Number($("#planMonthPrice").value||0)*100),quarter_price:Math.round(Number($("#planQuarterPrice").value||0)*100),half_year_price:Math.round(Number($("#planHalfPrice").value||0)*100),year_price:Math.round(Number($("#planYearPrice").value||0)*100),transfer_enable:Math.round(Number($("#planTraffic").value||0)*1073741824),speed:$("#planSpeed").value.trim(),region:$("#planRegion").value.trim(),region_name:$("#planRegionName").value.trim(),content:$("#planContent").value.trim(),show:Number($("#planShow").value),hot:Number($("#planHot").value)};try{await legacyAdmin("/plans",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(p)});res.className="form-result success";res.textContent="套餐已保存";toast("节点套餐已保存");$("#planFormPanel").hidden=true;loadPlans()}catch(e){res.className="form-result error";res.textContent=e.message||"保存失败"}finally{btn.disabled=false}});
async function loadNodeServers(){
 const body=$("#nodesBody");if(!body)return;body.innerHTML='<tr><td colspan="6" class="table-empty">正在读取节点服务器…</td></tr>';
 try{const d=await legacyAdmin("/servers"),nodes=dataList(d);body.innerHTML=nodes.length?nodes.map(n=>'<tr><td><b>'+escapeHtml(n.name)+'</b></td><td class="mono">'+escapeHtml(n.ip||"—")+'</td><td>'+escapeHtml(n.region_name||n.region||"—")+'</td><td>'+Number(n.api_port||0)+'</td><td>'+statusPill(Number(n.enabled)?"active":"inactive")+'</td><td><div class="table-actions"><button class="btn btn-secondary btn-small" data-node-edit="'+n.id+'">编辑</button><button class="btn btn-secondary btn-small" data-node-toggle="'+n.id+'" data-enabled="'+(Number(n.enabled)?0:1)+'">'+(Number(n.enabled)?"停用":"启用")+'</button><button class="btn btn-danger btn-small" data-node-delete="'+n.id+'">删除</button></div></td></tr>').join(""):'<tr><td colspan="6" class="table-empty">暂无节点服务器配置</td></tr>';$("#nodesCount").textContent="共 "+nodes.length+" 台节点服务器";body.querySelectorAll("[data-node-edit]").forEach(b=>b.addEventListener("click",()=>{const n=nodes.find(x=>String(x.id)===b.dataset.nodeEdit);if(n)editNode(n)}));body.querySelectorAll("[data-node-toggle]").forEach(b=>b.addEventListener("click",async()=>{const n=nodes.find(x=>String(x.id)===b.dataset.nodeToggle);if(!n)return;try{await legacyAdmin("/servers/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...n,enabled:Number(b.dataset.enabled)})});toast("节点服务器状态已更新");loadNodeServers()}catch(e){toast("操作失败："+e.message)}}));body.querySelectorAll("[data-node-delete]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("确认删除该节点服务器配置？"))return;try{await legacyAdmin("/servers/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:Number(b.dataset.nodeDelete)})});toast("节点服务器配置已删除");loadNodeServers()}catch(e){toast("删除失败："+e.message)}}))}
 catch(e){body.innerHTML='<tr><td colspan="6" class="table-empty error-text">节点服务器读取失败：'+escapeHtml(e.message||"接口错误")+'</td></tr>'}
}

function editNode(n){$("#nodeId").value=n.id||"";$("#nodeName").value=n.name||"";$("#nodeIp").value=n.ip||"";$("#nodeDomain").value=n.domain||"";$("#nodeRegion").value=n.region||"";$("#nodeRegionName").value=n.region_name||"";$("#nodeApiPort").value=n.api_port||54323;$("#nodeAdminPort").value=n.admin_port||54324;$("#nodeSort").value=n.sort||0;$("#nodeEnabled").value=String(n.enabled??1);$("#nodeFormTitle").textContent=n.id?"编辑节点服务器":"新增节点服务器";$("#nodeFormPanel").hidden=false;$("#nodeFormPanel").scrollIntoView({behavior:"smooth",block:"start"})}
$("#nodeAddBtn")?.addEventListener("click",()=>editNode({}));$("#nodeFormClose")?.addEventListener("click",()=>$("#nodeFormPanel").hidden=true);
$("#nodeForm")?.addEventListener("submit",async e=>{e.preventDefault();const res=$("#nodeFormResult"),btn=$("#nodeSaveBtn");btn.disabled=true;try{await legacyAdmin("/servers/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:Number($("#nodeId").value)||undefined,name:$("#nodeName").value.trim(),ip:$("#nodeIp").value.trim(),domain:$("#nodeDomain").value.trim(),region:$("#nodeRegion").value.trim(),region_name:$("#nodeRegionName").value.trim(),api_port:Number($("#nodeApiPort").value),admin_port:Number($("#nodeAdminPort").value),sort:Number($("#nodeSort").value||0),enabled:Number($("#nodeEnabled").value)})});res.className="form-result success";res.textContent="节点服务器配置已保存";toast("节点服务器已保存");$("#nodeFormPanel").hidden=true;loadNodeServers()}catch(e){res.className="form-result error";res.textContent=e.message||"保存失败"}finally{btn.disabled=false}});
async function loadNodeOrders(){
 const body=$("#nodeAdminOrdersBody");if(!body)return;
 body.innerHTML='<tr><td colspan="6" class="table-empty">正在读取全站节点订单…</td></tr>';
 try{
  const d=await legacyAdmin("/orders"),orders=dataList(d);
  body.innerHTML=orders.length?orders.slice(0,200).map(o=>{
   const amount=Number(o.total_amount??o.amount??0)/100;
   const status=Number(o.status)===0?"待支付":Number(o.status)===1?"已支付":Number(o.refunded)===1?"已退款":String(o.status??"未知");
   return '<tr><td class="mono">'+escapeHtml(o.trade_no||o.order_no||o.id||"—")+'</td><td>'+escapeHtml(o.user_email||o.email||o.user_id||"—")+'</td><td>'+escapeHtml(o.plan_name||("套餐 #"+(o.plan_id||"—")))+'</td><td class="money">'+formatCny(amount)+'</td><td>'+statusPill(status)+'</td><td>'+escapeHtml(formatAdminDate(o.created_at))+'</td></tr>';
  }).join(""):'<tr><td colspan="6" class="table-empty">暂无节点服务订单</td></tr>';
  $("#nodeAdminOrdersCount").textContent="共 "+orders.length.toLocaleString("zh-CN")+" 条节点订单";
 }catch(e){
  body.innerHTML='<tr><td colspan="6" class="table-empty error-text">节点订单读取失败：'+escapeHtml(e.message||"接口错误")+'</td></tr>';
  $("#nodeAdminOrdersCount").textContent="读取失败";
 }
}
$("#nodeOrdersRefresh")?.addEventListener("click",loadNodeOrders);
function editProtocolNode(n={}){
 const cfg=typeof n.config_json==="string"?(()=>{try{return JSON.parse(n.config_json)}catch{return {}}})():(n.config_json||{});
 $("#protocolNodeId").value=n.id||"";$("#protocolNodeName").value=n.name||"";$("#protocolNodeType").value=n.protocol||"vless";$("#protocolNodePort").value=n.port||443;$("#protocolNodeRegion").value=cfg.region||"";
 $("#protocolNodeDomains").value=(cfg.domains||[]).join("\n");$("#protocolNodeSni").value=cfg.sni||"";$("#protocolNodeNetwork").value=cfg.network||"tcp";$("#protocolNodePublicKey").value=cfg.reality_public_key||"";$("#protocolNodeShortId").value=cfg.short_id||"";$("#protocolNodeWsPath").value=cfg.ws_path||"/";$("#protocolNodeMethod").value=cfg.method||"aes-256-gcm";$("#protocolNodeObfsPassword").value=cfg.obfs_password||"";$("#protocolNodeSort").value=n.sort??100;$("#protocolNodeEnabled").value=String(n.enabled??1);$("#protocolNodeFormTitle").textContent=n.id?"编辑协议节点":"新增协议节点";$("#protocolNodeFormResult").textContent="";$("#protocolNodeFormPanel").hidden=false;$("#protocolNodeFormPanel").scrollIntoView({behavior:"smooth",block:"start"});
}
$("#protocolNodeAddBtn")?.addEventListener("click",()=>editProtocolNode({}));
$("#protocolNodeFormClose")?.addEventListener("click",()=>$("#protocolNodeFormPanel").hidden=true);
async function loadProtocolNodes(){
 const body=$("#protocolNodesBody");if(!body)return;body.innerHTML='<tr><td colspan="7" class="table-empty">正在读取真实协议节点与端口连通性…</td></tr>';
 try{
  const [nr,hr]=await Promise.all([legacyAdmin("/nodes"),legacyAdmin("/nodes/health")]);
  const nodes=dataList(nr),health=dataList(hr),healthById={};health.forEach(x=>healthById[String(x.id)]=x);
  body.innerHTML=nodes.length?nodes.map(n=>{
   const h=healthById[String(n.id)]||{},checks=h.domains||[],up=checks.filter(x=>x.reachable).length;
   const domains=checks.length?up+"/"+checks.length+" 可达":"未检测";
   const state=Number(n.enabled)?"已启用":"已停用";
   return '<tr><td><b>'+escapeHtml(n.name||"—")+'</b></td><td>'+escapeHtml(String(n.protocol||"").toUpperCase())+'</td><td>'+escapeHtml(h.region||"—")+'</td><td>'+Number(n.port||0)+'</td><td>'+escapeHtml(domains)+(h.reachable?' · 在线':' · 不可达')+'</td><td>'+statusPill(Number(n.enabled)&&h.reachable?"active":Number(n.enabled)?"unreachable":"inactive")+'</td><td><div class="table-actions"><button class="btn btn-secondary btn-small" data-proto-edit="'+n.id+'">编辑</button><button class="btn btn-secondary btn-small" data-proto-toggle="'+n.id+'" data-enabled="'+(Number(n.enabled)?0:1)+'">'+(Number(n.enabled)?"停用":"启用")+'</button><button class="btn btn-danger btn-small" data-proto-delete="'+n.id+'">删除</button></div></td></tr>';
  }).join(""):'<tr><td colspan="7" class="table-empty">暂无协议节点，添加后才会出现在客户订阅中</td></tr>';
  $("#protocolNodesCount").textContent="共 "+nodes.length+" 个协议节点 · "+nodes.filter(x=>Number(x.enabled)).length+" 个启用";
  document.querySelectorAll("[data-proto-cap]").forEach(card=>{
   const proto=card.dataset.protoCap;
   if(["socks5","mtproto","ss2022","http"].includes(proto))return;
   const group=nodes.filter(x=>x.protocol===proto),enabled=group.filter(x=>Number(x.enabled)),online=enabled.filter(x=>healthById[String(x.id)]?.reachable);
   card.querySelector("small").textContent=enabled.length?"启用 "+enabled.length+" · 在线 "+online.length:"尚无启用节点";
   card.classList.toggle("pending",!enabled.length);
  });
  body.querySelectorAll("[data-proto-edit]").forEach(btn=>btn.addEventListener("click",()=>{const n=nodes.find(x=>String(x.id)===btn.dataset.protoEdit);if(n)editProtocolNode(n)}));
  body.querySelectorAll("[data-proto-toggle]").forEach(btn=>btn.addEventListener("click",async()=>{try{await legacyAdmin("/nodes/toggle",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:Number(btn.dataset.protoToggle),enabled:Number(btn.dataset.enabled)})});toast(Number(btn.dataset.enabled)?"协议节点已启用":"协议节点已停用");await loadProtocolNodes()}catch(e){toast("协议状态更新失败："+(e.message||"接口错误"))}}));
  body.querySelectorAll("[data-proto-delete]").forEach(btn=>btn.addEventListener("click",async()=>{if(!confirm("删除该协议节点后，它会从客户订阅中移除。确认删除？"))return;try{await legacyAdmin("/nodes/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:Number(btn.dataset.protoDelete)})});toast("协议节点已删除");await loadProtocolNodes()}catch(e){toast("删除失败："+(e.message||"接口错误"))}}));
 }catch(e){body.innerHTML='<tr><td colspan="7" class="table-empty error-text">读取协议节点失败：'+escapeHtml(e.message||"接口错误")+'</td></tr>';$("#protocolNodesCount").textContent="读取失败"}
}
$("#protocolNodesRefresh")?.addEventListener("click",loadProtocolNodes);
$("#protocolNodeForm")?.addEventListener("submit",async e=>{
 e.preventDefault();const btn=$("#protocolNodeSaveBtn"),res=$("#protocolNodeFormResult");btn.disabled=true;res.textContent="正在保存真实节点配置…";
 const proto=$("#protocolNodeType").value,domains=$("#protocolNodeDomains").value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(!domains.length){res.textContent="至少填写一个节点域名";btn.disabled=false;return}
 const cfg={domains,region:$("#protocolNodeRegion").value.trim(),sni:$("#protocolNodeSni").value.trim(),network:$("#protocolNodeNetwork").value,ws_path:$("#protocolNodeWsPath").value.trim()||"/",reality_public_key:$("#protocolNodePublicKey").value.trim(),short_id:$("#protocolNodeShortId").value.trim(),fingerprint:"chrome",tls:true,skip_cert_verify:true,method:$("#protocolNodeMethod").value,obfs:proto==="hysteria2"?"salamander":"",obfs_password:$("#protocolNodeObfsPassword").value};
 const payload={id:Number($("#protocolNodeId").value)||undefined,name:$("#protocolNodeName").value.trim(),protocol:proto,port:Number($("#protocolNodePort").value),enabled:Number($("#protocolNodeEnabled").value),sort:Number($("#protocolNodeSort").value||100),config_json:cfg};
 try{await legacyAdmin("/nodes/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});res.className="form-result success";res.textContent="节点协议配置已保存。订阅端会按用户自动生成独立凭证。";toast("协议节点保存成功");$("#protocolNodeFormPanel").hidden=true;await loadProtocolNodes()}
 catch(e){res.className="form-result error";res.textContent=e.message||"保存失败"}
 finally{btn.disabled=false}
});
$("#applyRobotPrice")?.addEventListener("click",()=>{
 const raw=$("#robotPriceTemplate").value;if(!raw){toast("先选择机器人套餐价格");return}
 const [gb,price]=raw.split("|");$("#planTraffic").value=gb;$("#planMonthPrice").value=Number(price).toFixed(2);$("#planQuarterPrice").value="";$("#planHalfPrice").value="";$("#planYearPrice").value="";$("#planType").value="monthly";$("#planName").value=gb+"GB·月付";$("#planContent").value="30天 / "+gb+"GB（采用机器人现行价）";toast("已填入机器人当前套餐价格，保存后才会生效");
});
async function loadNodes(){await Promise.allSettled([loadPlans(),loadNodeServers(),loadNodeOrders(),loadProtocolNodes()])}
async function loadAiStatus(){
 try{const d=await legacyAdmin("/config/ai");$("#zhipuModel").textContent=d.model||"GLM-4-Flash";$("#zhipuStatus").textContent=d.configured?"已连接":"未配置";$("#zhipuStatus").className="tag "+(d.configured?"tag-green":"")}
 catch(e){$("#zhipuStatus").textContent="状态读取失败";$("#zhipuStatus").className="tag"}
}
async function loadSupport(){
 const users=$("#chatUsersList"),ticketsBody=$("#ticketsBody");if(users)users.innerHTML='<div class="table-empty">正在读取客户会话…</div>';if(ticketsBody)ticketsBody.innerHTML='<tr><td colspan="7" class="table-empty">正在读取工单…</td></tr>';
 const [cr,tr]=await Promise.allSettled([legacyAdmin("/chat/users"),legacyAdmin("/tickets?status="+encodeURIComponent($("#ticketStatus")?.value||"")+"&page=1&size=50")]);loadAiStatus();
 if(cr.status==="fulfilled"){const chats=dataList(cr.value);$("#supportChatCount").textContent=chats.length+" 个会话";users.innerHTML=chats.length?chats.map(c=>'<button class="chat-user" data-chat-id="'+c.ticket_id+'"><b>'+escapeHtml(c.email||("客户 #"+c.user_id))+'</b><small>'+escapeHtml(c.last_message||"暂无消息")+'</small><span>'+escapeHtml(formatAdminDate(c.updated_at))+'</span></button>').join(""):'<div class="table-empty">暂无在线客服会话</div>';users.querySelectorAll("[data-chat-id]").forEach(b=>b.addEventListener("click",()=>loadChatHistory(Number(b.dataset.chatId))))}else users.innerHTML='<div class="table-empty error-text">会话读取失败：'+escapeHtml(cr.reason?.message||"接口错误")+'</div>';
 if(tr.status==="fulfilled"){const d=tr.value,items=dataList(d);ticketsBody.innerHTML=items.length?items.map(t=>'<tr><td class="mono">#'+t.id+'</td><td>'+escapeHtml(t.email||"—")+'</td><td>'+escapeHtml(t.subject||"—")+'</td><td>'+escapeHtml(t.priority||"普通")+'</td><td>'+statusPill(({1:"pending",2:"processing",3:"completed"})[Number(t.status)]||t.status_text||t.status)+'</td><td>'+escapeHtml(formatAdminDate(t.updated_at))+'</td><td><button class="btn btn-secondary btn-small" data-ticket-open="'+t.id+'">查看</button></td></tr>').join(""):'<tr><td colspan="7" class="table-empty">暂无售后工单</td></tr>';ticketsBody.querySelectorAll("[data-ticket-open]").forEach(b=>b.addEventListener("click",()=>openTicket(Number(b.dataset.ticketOpen))))}else ticketsBody.innerHTML='<tr><td colspan="7" class="table-empty error-text">工单读取失败：'+escapeHtml(tr.reason?.message||"接口错误")+'</td></tr>';
}
let activeChatId=0,activeChatHandoff=0;
async function loadChatHistory(id){
 activeChatId=id;$("#chatRoomTitle").textContent="客户会话 #"+id;$("#chatRoomMeta").textContent="正在读取消息…";$("#chatMessages").innerHTML='<div class="empty-state">正在读取聊天记录…</div>';$("#chatReplyText").disabled=false;$("#chatReplyBtn").disabled=false;$("#chatHandoffBtn").disabled=false;
 try{const d=await legacyAdmin("/chat/history?id="+id),messages=d.messages||d.items||[];activeChatHandoff=Number(d.handoff||0);$("#chatRoomMeta").textContent=activeChatHandoff?"人工客服接管中":"AI 客服自动回复中";$("#chatHandoffBtn").textContent=activeChatHandoff?"交还 AI":"接管会话";$("#chatMessages").innerHTML=messages.map(m=>'<div class="chat-message '+(m.sender==="admin"?"outgoing":"incoming")+'"><small>'+escapeHtml(m.sender==="user"?"客户":m.sender==="ai"?"AI 客服":"人工客服")+' · '+escapeHtml(formatAdminDate(m.created_at))+'</small><p>'+escapeHtml(m.content)+'</p></div>').join("")||'<div class="empty-state">暂无消息</div>';$("#chatMessages").scrollTop=$("#chatMessages").scrollHeight}catch(e){$("#chatMessages").innerHTML='<div class="empty-state error-text">读取失败：'+escapeHtml(e.message||"接口错误")+'</div>'}
}
$("#chatReplyForm")?.addEventListener("submit",async e=>{e.preventDefault();const content=$("#chatReplyText").value.trim();if(!activeChatId||!content)return;$("#chatReplyBtn").disabled=true;try{await legacyAdmin("/chat/reply",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:activeChatId,content})});$("#chatReplyText").value="";toast("客服回复已发送");loadChatHistory(activeChatId)}catch(e){toast("发送失败："+e.message)}finally{$("#chatReplyBtn").disabled=false}});
$("#chatHandoffBtn")?.addEventListener("click",async()=>{if(!activeChatId)return;const next=activeChatHandoff?0:1;try{await legacyAdmin("/chat/handoff",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:activeChatId,handoff:next})});toast(next?"已接管客户会话":"已交还 AI 客服");loadChatHistory(activeChatId)}catch(e){toast("操作失败："+e.message)}});
async function openTicket(id){
 try{const d=await legacyAdmin("/ticket/detail?id="+id);const modal=$("#ticketModal");$("#ticketModalTitle").textContent=d.subject||("售后工单 #"+id);$("#ticketModalMeta").textContent=(d.email||"客户")+" · "+orderStatusLabel(d.status);$("#ticketModalContent").textContent=d.content||"—";$("#ticketModalReply").value=d.reply||"";$("#ticketModalStatus").value=String(d.status??1);$("#ticketModal").dataset.ticketId=id;$("#ticketModal").hidden=false}catch(e){toast("读取工单失败："+e.message)}
}
$("#ticketModalClose")?.addEventListener("click",()=>$("#ticketModal").hidden=true);
$("#ticketModalForm")?.addEventListener("submit",async e=>{e.preventDefault();const id=Number($("#ticketModal").dataset.ticketId),reply=$("#ticketModalReply").value.trim(),status=Number($("#ticketModalStatus").value);if(!id||!reply)return;try{await legacyAdmin("/ticket/reply",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,reply})});await legacyAdmin("/ticket/status",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status})});toast("工单回复与状态已保存");$("#ticketModal").hidden=true;loadSupport()}catch(e){toast("回复失败："+e.message)}});
$("#ticketStatus")?.addEventListener("change",loadSupport);$("#supportRefresh")?.addEventListener("click",loadSupport);
async function loadEmail(){
 const list=$("#emailTemplatesList");if(!list)return;list.innerHTML='<div class="table-empty">正在读取邮件模板…</div>';
 try{const [t,c]=await Promise.all([legacyAdmin("/mail/templates"),legacyAdmin("/config/mail")]);const templates=dataList(t);list.innerHTML=templates.length?templates.map(x=>'<div class="template-item"><div><b>'+escapeHtml(x.name||x.key)+'</b><small>'+escapeHtml(x.subject||"无主题")+'</small></div><div class="table-actions"><button class="btn btn-secondary btn-small" data-template-use="'+escapeHtml(x.key)+'">载入</button><button class="btn btn-secondary btn-small" data-template-edit="'+escapeHtml(x.key)+'">编辑</button><button class="btn btn-danger btn-small" data-template-delete="'+escapeHtml(x.key)+'">删除</button></div></div>').join(""):'<div class="table-empty">暂无模板，可创建常用邮件模板</div>';list.querySelectorAll("[data-template-use]").forEach(b=>b.addEventListener("click",()=>{const x=templates.find(y=>y.key===b.dataset.templateUse);if(x){$("#emailSubject").value=x.subject||"";$("#emailBody").value=x.body||"";toast("模板已载入")}}));list.querySelectorAll("[data-template-edit]").forEach(b=>b.addEventListener("click",()=>editEmailTemplate(templates.find(y=>y.key===b.dataset.templateEdit))));list.querySelectorAll("[data-template-delete]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("确定删除这个邮件模板？"))return;try{await legacyAdmin("/mail/templates/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({key:b.dataset.templateDelete})});toast("模板已删除");loadEmail()}catch(e){toast("删除失败："+e.message)}}));$("#mailSmtpHost").value=c.smtp_host||"";$("#mailSmtpPort").value=c.smtp_port||465;$("#mailSmtpUser").value=c.smtp_user||"";$("#mailSmtpPass").value="";$("#mailSenderEmail").value=c.sender_email||"";$("#mailSenderName").value=c.sender_name||"";$("#mailConfigStatus").textContent=c.smtp_host&&c.sender_email?"已配置":"待完善";$("#emailSystemHint")&&($("#emailSystemHint").textContent=(c.smtp_host?"SMTP 已配置 · "+(c.sender_email||"发件地址未设置"):"SMTP 配置待完善"))}
 catch(e){list.innerHTML='<div class="table-empty error-text">邮件配置读取失败：'+escapeHtml(e.message||"接口错误")+'</div>'}
}
function editEmailTemplate(t={}){$("#emailTemplateKey").value=t.key||"";$("#emailTemplateKey").readOnly=!!t.key;$("#emailTemplateName").value=t.name||"";$("#emailTemplateSubject").value=t.subject||"";$("#emailTemplateBody").value=t.body||"";$("#emailTemplatePanel").hidden=false;$("#emailTemplateTitle").textContent=t.key?"编辑邮件模板":"新建邮件模板";$("#emailTemplatePanel").scrollIntoView({behavior:"smooth",block:"start"})}
$("#emailTemplateNew")?.addEventListener("click",()=>editEmailTemplate({}));$("#emailTemplateClose")?.addEventListener("click",()=>$("#emailTemplatePanel").hidden=true);
$("#emailTemplateForm")?.addEventListener("submit",async e=>{e.preventDefault();const p={key:$("#emailTemplateKey").value.trim(),name:$("#emailTemplateName").value.trim(),subject:$("#emailTemplateSubject").value.trim(),body:$("#emailTemplateBody").value};try{await legacyAdmin("/mail/templates/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(p)});toast("邮件模板已保存");$("#emailTemplatePanel").hidden=true;loadEmail()}catch(e){$("#emailTemplateResult").textContent=e.message||"保存失败"}});
$("#emailPreviewBtn")?.addEventListener("click",()=>{const w=window.open("","_blank","width=760,height=760");if(!w){toast("浏览器拦截了预览窗口");return}w.document.write('<!doctype html><meta charset="utf-8"><title>邮件预览</title><h2>'+escapeHtml($("#emailSubject").value)+'</h2><hr>'+$("#emailBody").value);w.document.close()});
$("#emailSendForm")?.addEventListener("submit",async e=>{e.preventDefault();const subject=$("#emailSubject").value.trim(),body=$("#emailBody").value.trim(),target=$("#emailTarget").value;if(!subject||!body)return;const targetLabel=({all:"全部注册用户",paid:"已付费用户",expiring:"7 天内到期用户"})[target]||target;if(!confirm("确认向「"+targetLabel+"」发送邮件？邮件将由服务器后台异步发送。"))return;const btn=$("#emailSendBtn");btn.disabled=true;try{const d=await legacyAdmin("/mail/send",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({subject,body,target})});$("#emailSendResult").className="form-result success";$("#emailSendResult").textContent="发送任务已加入队列，预计收件人 "+(d.queued??"—")+" 人";toast("邮件发送任务已提交")}catch(e){$("#emailSendResult").className="form-result error";$("#emailSendResult").textContent=e.message||"发送失败"}finally{btn.disabled=false}});

$("#mailConfigForm")?.addEventListener("submit",async e=>{
 e.preventDefault();const btn=$("#mailConfigSave"),result=$("#mailConfigResult");btn.disabled=true;result.className="form-result";result.textContent="正在保存…";
 const payload={smtp_host:$("#mailSmtpHost").value.trim(),smtp_port:Number($("#mailSmtpPort").value),smtp_user:$("#mailSmtpUser").value.trim(),smtp_pass:$("#mailSmtpPass").value,sender_email:$("#mailSenderEmail").value.trim(),sender_name:$("#mailSenderName").value.trim()};
 try{await legacyAdmin("/config/mail",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});result.className="form-result success";result.textContent="邮件配置已保存，留空密码时保留原密码";$("#mailSmtpPass").value="";toast("SMTP 配置已更新");await loadEmail()}catch(e){result.className="form-result error";result.textContent=e.message||"保存失败"}finally{btn.disabled=false}
});
$("#emailRefresh")?.addEventListener("click",loadEmail);
async function loadNotices(){
 const body=$("#noticesBody");if(!body)return;body.innerHTML='<tr><td colspan="7" class="table-empty">正在读取公告…</td></tr>';
 try{const d=await legacyAdmin("/notices"),items=dataList(d);body.innerHTML=items.length?items.map(n=>'<tr><td><b>'+escapeHtml(n.title)+'</b></td><td>'+escapeHtml(n.type||"普通")+'</td><td>'+escapeHtml(n.display||"—")+'</td><td>'+Number(n.read_count||0).toLocaleString("zh-CN")+'</td><td>'+statusPill(Number(n.status)?"active":"inactive")+'</td><td>'+escapeHtml(formatAdminDate(n.start_at))+' 至 '+escapeHtml(formatAdminDate(n.end_at))+'</td><td><div class="table-actions"><button class="btn btn-secondary btn-small" data-notice-edit="'+n.id+'">编辑</button><button class="btn btn-secondary btn-small" data-notice-toggle="'+n.id+'" data-status="'+(Number(n.status)?0:1)+'">'+(Number(n.status)?"停用":"发布")+'</button><button class="btn btn-danger btn-small" data-notice-delete="'+n.id+'">删除</button></div></td></tr>').join(""):'<tr><td colspan="7" class="table-empty">暂无公告</td></tr>';$("#noticesCount").textContent="共 "+items.length+" 条公告";body.querySelectorAll("[data-notice-edit]").forEach(b=>b.addEventListener("click",()=>{const n=items.find(x=>String(x.id)===b.dataset.noticeEdit);if(n)editNotice(n)}));body.querySelectorAll("[data-notice-toggle]").forEach(b=>b.addEventListener("click",async()=>{try{await legacyAdmin("/notices",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:Number(b.dataset.noticeToggle),status:Number(b.dataset.status)})});toast("公告状态已更新");loadNotices()}catch(e){toast("操作失败："+e.message)}}));body.querySelectorAll("[data-notice-delete]").forEach(b=>b.addEventListener("click",async()=>{if(!confirm("确认删除这条公告？"))return;try{await legacyAdmin("/notices/delete",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:Number(b.dataset.noticeDelete)})});toast("公告已删除");loadNotices()}catch(e){toast("删除失败："+e.message)}}))}
 catch(e){body.innerHTML='<tr><td colspan="7" class="table-empty error-text">公告读取失败：'+escapeHtml(e.message||"接口错误")+'</td></tr>'}
}
function editNotice(n={}){$("#noticeId").value=n.id||"";$("#noticeTitle").value=n.title||"";$("#noticeType").value=n.type||"normal";$("#noticeContent").value=n.content||"";$("#noticeDisplay").value=n.display||"banner";$("#noticeTargetPlan").value=n.target_plan||0;$("#noticeStatus").value=String(n.status??1);$("#noticePinned").value=String(n.pinned??0);$("#noticeStart").value=n.start_at?new Date(Number(n.start_at)*1000).toISOString().slice(0,16):"";$("#noticeEnd").value=n.end_at?new Date(Number(n.end_at)*1000).toISOString().slice(0,16):"";$("#noticeFormTitle").textContent=n.id?"编辑公告":"发布新公告";$("#noticeFormPanel").hidden=false;$("#noticeFormPanel").scrollIntoView({behavior:"smooth",block:"start"})}
$("#noticeAddBtn")?.addEventListener("click",()=>editNotice({}));$("#noticeFormClose")?.addEventListener("click",()=>$("#noticeFormPanel").hidden=true);
$("#noticeForm")?.addEventListener("submit",async e=>{e.preventDefault();const date=v=>v?Math.floor(new Date(v).getTime()/1000):0;const p={id:Number($("#noticeId").value)||undefined,title:$("#noticeTitle").value.trim(),type:$("#noticeType").value,content:$("#noticeContent").value.trim(),display:$("#noticeDisplay").value,target_plan:Number($("#noticeTargetPlan").value||0),status:Number($("#noticeStatus").value),pinned:Number($("#noticePinned").value),start_at:date($("#noticeStart").value),end_at:date($("#noticeEnd").value)};try{await legacyAdmin("/notices",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(p)});toast("公告已保存");$("#noticeFormPanel").hidden=true;loadNotices()}catch(e){$("#noticeFormResult").textContent=e.message||"保存失败"}});
$("#noticesRefresh")?.addEventListener("click",loadNotices);

const botNames={fakabot:"晴天号铺机器人",tg:"TG 签到机器人",mivra:"Mivra 签到机器人"};
async function loadBots(){
 const grid=$("#botGrid");if(!grid)return;
 $("#botsUpdated").textContent="正在读取机器人进程和用户统计…";
 const [stateResult,statsResult]=await Promise.allSettled([adminRequest("/api/admin/bots"),legacyAdmin("/bots/matrix/stats")]);
 const statePayload=stateResult.status==="fulfilled"?stateResult.value:{};
 const bots=Array.isArray(statePayload.bots)?statePayload.bots:dataList(statePayload);
 const stats=statsResult.status==="fulfilled"?dataList(statsResult.value):[];
 const cardMap={safew:"tg",mivra:"mivra",qingtian:"fakabot"};
 const nameMap={safew:"TG 签到机器人",mivra:"Mivra 签到机器人",qingtian:"晴天号铺机器人"};
 bots.forEach(bot=>{
  const key=bot.key||({1:"safew",2:"mivra",3:"qingtian"})[bot.id];
  const card=document.querySelector('[data-bot-card="'+(cardMap[key]||key)+'"]');if(!card)return;
  const state=card.querySelector(".bot-state"),running=!!bot.online||bot.status==="active",enabled=bot.status==="active"||bot.status===true||Number(bot.status)===1;
  state.textContent=running?"运行中":enabled?"已启用 · 未运行":"已停用";
  state.className="bot-state "+(running?"running":enabled?"pending":"stopped");
  card.querySelector("[data-bot-pid]").textContent=bot.pid||"—";
  card.querySelector("[data-bot-enabled]").textContent=enabled?"已启用":"已停用";
  card.querySelectorAll("[data-bot-action]").forEach(btn=>{btn.disabled=(btn.dataset.botAction==="start"&&running)||(btn.dataset.botAction==="stop"&&!running);});
 });
 const statsBody=$("#botStatsBody");
 if(statsBody){
  statsBody.innerHTML=stats.length?stats.map(x=>{
   const key=x.bot||x.key||"",name=nameMap[key]||key;
   const row=grid.querySelector('[data-bot-card="'+(cardMap[key]||key)+'"]');
   if(row){
    const set=(k,v)=>{const el=row.querySelector('[data-bot-stat="'+k+'"]');if(el)el.textContent=v};
    set("total","用户 "+Number(x.total_users??x.total??0).toLocaleString("zh-CN"));
    set("today","今日签到 "+Number(x.today_sign||0).toLocaleString("zh-CN"));
    set("paid","付费 "+Number(x.paid_users||0).toLocaleString("zh-CN"));
   }
   return '<tr><td>'+escapeHtml(name)+'</td><td>'+Number(x.total_users??x.total??0).toLocaleString("zh-CN")+'</td><td>'+Number(x.today_sign||0).toLocaleString("zh-CN")+'</td><td>'+Number(x.paid_users||0).toLocaleString("zh-CN")+'</td><td>'+Number(x.active_agents||0).toLocaleString("zh-CN")+'</td><td><button class="btn btn-secondary btn-small" data-bot-users="'+escapeHtml(key)+'">查看用户</button></td></tr>';
  }).join(""):'<tr><td colspan="6" class="table-empty">'+(statsResult.status==="rejected"?"机器人用户统计读取失败":"暂无机器人统计")+'</td></tr>';
  statsBody.querySelectorAll("[data-bot-users]").forEach(btn=>btn.addEventListener("click",()=>{$("#botUserFilter").value=btn.dataset.botUsers;loadBotUsers()}));
 }
 $("#botStatsUpdated").textContent=statsResult.status==="fulfilled"?"真实数据库 · "+new Date().toLocaleTimeString("zh-CN"):"统计接口暂不可用";
 $("#botsUpdated").textContent=stateResult.status==="fulfilled"?"最后更新："+new Date().toLocaleString("zh-CN"):"进程状态读取失败："+(stateResult.reason?.message||"服务暂不可用");
 await loadBotUsers();
}
async function loadBotUsers(){
 const body=$("#botUsersBody");if(!body)return;
 const bot=$("#botUserFilter")?.value||"safew";
 body.innerHTML='<tr><td colspan="7" class="table-empty">正在读取机器人用户数据…</td></tr>';
 try{
  const d=await legacyAdmin("/bots/matrix/users?bot_name="+encodeURIComponent(bot));
  const users=dataList(d);
  body.innerHTML=users.length?users.slice(0,500).map(u=>{
   const traffic=(Number(u.traffic_mb||0)/1024).toFixed(2)+" GB";
   const expire=Number(u.expire||0)>0?formatAdminDate(u.expire):"未开通";
   const status=Number(u.banned)?"已封禁":Number(u.activated)?"正常":"未激活";
   return '<tr><td class="mono">'+escapeHtml(u.tg_id||"—")+'</td><td>'+escapeHtml(u.nickname||u.username||"—")+'</td><td>'+traffic+'</td><td>'+escapeHtml(expire)+'</td><td>'+Number(u.balance||0).toFixed(2)+' USDT</td><td>'+statusPill(status)+'</td><td>'+escapeHtml(u.last_sign||"—")+'</td></tr>';
  }).join(""):'<tr><td colspan="7" class="table-empty">该机器人暂无用户记录</td></tr>';
  $("#botUsersCount").textContent="当前机器人 "+users.length.toLocaleString("zh-CN")+" 位用户";
 }catch(e){body.innerHTML='<tr><td colspan="7" class="table-empty error-text">读取机器人用户失败：'+escapeHtml(e.message||"接口错误")+'</td></tr>';$("#botUsersCount").textContent="读取失败"}
}
$("#botUsersRefresh")?.addEventListener("click",loadBotUsers);
$("#botUserFilter")?.addEventListener("change",loadBotUsers);

$("#botsRefreshBtn")?.addEventListener("click",loadBots);
document.querySelectorAll("[data-bot-action]").forEach(btn=>btn.addEventListener("click",async()=>{
 const bot=btn.dataset.bot,action=btn.dataset.botAction;
 const verb={start:"启动",stop:"停止",restart:"重启"}[action];
 if(action!=="start"&&!confirm("确定要"+verb+botNames[bot]+"？"))return;
 const buttons=document.querySelectorAll('[data-bot="'+bot+'"]');buttons.forEach(b=>b.disabled=true);
 try{
  await adminRequest("/api/admin/bots/action",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({bot,action})});
  toast(botNames[bot]+verb+"指令已执行");
 }catch(error){toast("操作失败："+(error.message||"请稍后重试"))}
 finally{await loadBots()}
}));
document.querySelectorAll("[data-bot-logs]").forEach(btn=>btn.addEventListener("click",async()=>{
 const bot=btn.dataset.botLogs;$("#botLogTitle").textContent=botNames[bot]+" · 运行日志";$("#botLogStatus").textContent="读取中";$("#botLogs").textContent="正在读取日志…";
 try{const data=await adminRequest("/api/admin/bots/logs?bot="+encodeURIComponent(bot));$("#botLogs").textContent=data.logs||"暂无日志";$("#botLogStatus").textContent="读取完成"}
 catch(error){$("#botLogs").textContent="日志读取失败："+(error.message||"服务暂不可用");$("#botLogStatus").textContent="读取失败"}
}));
 
function moneyCny(value){const n=Number(value);return Number.isFinite(n)?"¥"+n.toFixed(2):"—"}
function nodeStatus(value){return ({fulfilled:"已开通",provisioning:"开通中",refunded:"已退款",failed:"失败",active:"使用中",expired:"已到期"})[String(value||"").toLowerCase()]||String(value||"未知")}
async function loadNodes(){await Promise.allSettled([loadPlans(),loadNodeServers()])}
async function refreshUpstream(){
 const body=$("#upstreamOrdersBody");$("#upstreamApiStatus").textContent="检查中";$("#upstreamBalanceStatus").textContent="查询中";body.innerHTML='<tr><td colspan="6" class="table-empty">正在读取上游采购记录…</td></tr>';
 try{
  const d=await legacyAdmin("/upstream/overview");
  $("#upstreamApiStatus").textContent="在线";
  if(d.balance_cny===null||d.balance_cny===undefined){$("#upstreamBalanceStatus").textContent="接口未提供";$("#upstreamBalance").textContent="暂不可查询";$("#upstreamBalanceHint").textContent="上游当前没有开放余额查询接口，不显示估算值"}
  else{$("#upstreamBalanceStatus").textContent="实时";$("#upstreamBalance").textContent=moneyCny(d.balance_cny);$("#upstreamBalanceHint").textContent="实时读取 · "+formatAdminDate(d.updated_at)}
  const os=d.orders||[];
  body.innerHTML=os.length?os.map(o=>'<tr><td class="mono">'+escapeHtml(o.supplier_order_id||o.supplier_order_no||"—")+'</td><td class="mono">'+escapeHtml(o.idempotency_key||"—")+'</td><td>'+escapeHtml(o.product_id||"—")+' × '+Number(o.count||0)+'</td><td class="money">—</td><td>'+statusPill(o.status)+'</td><td>'+escapeHtml(formatAdminDate(o.created_at))+'</td></tr>').join(""):'<tr><td colspan="6" class="table-empty">当前没有通过本采购代理创建的上游订单</td></tr>';
  $("#upstreamOrderCount")&&($("#upstreamOrderCount").textContent=Number(d.orders_total??os.length).toLocaleString("zh-CN")+" 条真实采购记录");
 }catch(e){$("#upstreamApiStatus").textContent="待接入";$("#upstreamBalanceStatus").textContent="接口未提供";$("#upstreamBalance").textContent="暂不可查询";body.innerHTML='<tr><td colspan="6" class="table-empty error-text">读取上游采购记录失败：'+escapeHtml(e.message||"接口不可用")+'</td></tr>'}
}
$("#nodesRefresh")?.addEventListener("click",loadNodes);$("#upstreamRefresh")?.addEventListener("click",refreshUpstream);

(async()=>{const authenticated=await verifyAdmin();checkApi();if(authenticated)loadOverview()})();
