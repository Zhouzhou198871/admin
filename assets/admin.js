"use strict";
const API_BASE="https://shop.lynli.me";
const TOKEN_KEY="qingtian_shop_token";
const $=s=>document.querySelector(s);
const REMEMBER_EMAIL_KEY="qingtian_admin_remembered_email";
const rememberedEmail=localStorage.getItem(REMEMBER_EMAIL_KEY);
if(rememberedEmail){$("#loginEmail").value=rememberedEmail;$("#rememberPassword").checked=true}
const pageNames={overview:"经营总览",orders:"订单管理",users:"用户管理",products:"商品与库存",nodes:"节点服务",support:"在线客服",email:"邮件系统",notices:"公告管理",upstream:"上游采购中心",recharge:"余额充值",bots:"机器人管理"};
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
function showPage(name){if(!pageNames[name])return;document.querySelectorAll(".page").forEach(el=>{const active=el.id==="page-"+name;el.classList.toggle("active",active);el.setAttribute("aria-hidden",String(!active))});document.querySelectorAll(".nav-item").forEach(el=>{const active=el.dataset.page===name;el.classList.toggle("active",active);if(active)el.setAttribute("aria-current","page");else el.removeAttribute("aria-current")});$("#pageCrumb").textContent=pageNames[name];$("#sidebar").classList.remove("open");$("#menuToggle").setAttribute("aria-expanded","false");window.scrollTo({top:0,behavior:"smooth"});const loaders={overview:loadOverview,orders:loadOrders,users:loadUsers,products:loadProducts,nodes:loadNodes,support:loadSupport,email:loadEmail,notices:loadNotices,upstream:refreshUpstream,bots:loadBots};if(loaders[name])loaders[name]();}
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
function statusText(status){return ({pending:"待处理",reserved:"已预留",delivered:"已交付",refunded:"已退款",failed:"失败",processing:"处理中",paid:"已支付",cancelled:"已取消",expired:"已过期",provisioning:"配置中",active:"可用",inactive:"已停用"})[String(status||"").toLowerCase()]||String(status||"未知")}
function statusPill(status){const value=String(status||"").toLowerCase();const cls=["delivered","paid","active"].includes(value)?"good":["failed","refunded","cancelled","expired","inactive"].includes(value)?"bad":"wait";return '<span class="status-pill '+cls+'">'+escapeHtml(statusText(value))+'</span>'}
async function legacyAdmin(path,options={}){return adminRequest("/api/admin/legacy"+path,options)}
function dataList(value){if(Array.isArray(value))return value;if(!value||typeof value!=="object")return [];return value.list||value.items||value.products||value.orders||value.users||value.rows||[]}
function dataTotal(value,list){return Number(value?.total??value?.count??value?.total_count??list.length)}
function cnyValue(value){const n=Number(value);return Number.isFinite(n)?n:0}
function formatCny(value){return "¥"+cnyValue(value).toFixed(2)}
function orderStatusLabel(value){const n=Number(value);if(Number.isFinite(n)&&String(value).trim()!=="")return ({0:"待支付",1:"待发货",2:"已发货",3:"已完成","-1":"已取消"})[n]||String(value);return statusText(value)}
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
 const body=$("#usersBody");if(!body)return;body.innerHTML='<tr><td colspan="5" class="table-empty">正在读取用户数据…</td></tr>';
 const q=$("#userSearch")?.value.trim()||"";
 try{
  const data=await legacyAdmin("/users");
  const users=dataList(data).filter(u=>!q||[u.email,u.nickname,u.short_id].some(v=>String(v||"").toLowerCase().includes(q.toLowerCase()))).slice(0,50);
  body.innerHTML=users.length?users.map(user=>'<tr><td><b>'+escapeHtml(user.email)+'</b></td><td>'+escapeHtml(user.nickname||user.name||"—")+'</td><td class="mono">'+escapeHtml(user.tg_user_id||user.tg_id||"—")+'</td><td class="money">'+formatCny(Number(user.balance||0)*4)+'</td><td>'+escapeHtml(formatAdminDate(user.created_at))+'</td></tr>').join(""):'<tr><td colspan="5" class="table-empty">没有找到匹配用户</td></tr>';
  $("#usersCount").textContent="全站用户 "+dataList(data).length.toLocaleString("zh-CN")+" 位（当前显示 "+users.length+" 位）";
 }catch(error){body.innerHTML='<tr><td colspan="5" class="table-empty error-text">读取失败：'+escapeHtml(error.message||"请求失败")+'</td></tr>';$("#usersCount").textContent="读取失败"}
}

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
 if(tab==="servers")loadNodeServers();else if(tab==="orders")loadNodeOrders();else loadPlans();
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
function editPlan(p){$("#planId").value=p.id||"";$("#planName").value=p.name||"";$("#planType").value=p.type||"node";$("#planMonthPrice").value=(Number(p.month_price||0)/100).toFixed(2);$("#planQuarterPrice").value=(Number(p.quarter_price||0)/100).toFixed(2);$("#planHalfPrice").value=(Number(p.half_year_price||0)/100).toFixed(2);$("#planYearPrice").value=(Number(p.year_price||0)/100).toFixed(2);$("#planTraffic").value=Number(p.transfer_enable||0);$("#planSpeed").value=p.speed||"";$("#planRegion").value=p.region||"";$("#planRegionName").value=p.region_name||"";$("#planContent").value=p.content||"";$("#planShow").value=String(p.show??1);$("#planHot").value=String(p.hot??0);$("#planFormTitle").textContent=p.id?"编辑节点套餐":"新增节点套餐";$("#planFormPanel").hidden=false;$("#planFormPanel").scrollIntoView({behavior:"smooth",block:"start"})}
$("#planAddBtn")?.addEventListener("click",()=>editPlan({}));$("#planFormClose")?.addEventListener("click",()=>$("#planFormPanel").hidden=true);
$("#planForm")?.addEventListener("submit",async e=>{e.preventDefault();const btn=$("#planSaveBtn"),res=$("#planFormResult");btn.disabled=true;res.textContent="正在保存…";const p={id:Number($("#planId").value)||undefined,name:$("#planName").value.trim(),type:$("#planType").value.trim(),month_price:Math.round(Number($("#planMonthPrice").value||0)*100),quarter_price:Math.round(Number($("#planQuarterPrice").value||0)*100),half_year_price:Math.round(Number($("#planHalfPrice").value||0)*100),year_price:Math.round(Number($("#planYearPrice").value||0)*100),transfer_enable:Number($("#planTraffic").value||0),speed:$("#planSpeed").value.trim(),region:$("#planRegion").value.trim(),region_name:$("#planRegionName").value.trim(),content:$("#planContent").value.trim(),show:Number($("#planShow").value),hot:Number($("#planHot").value)};try{await legacyAdmin("/plans",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(p)});res.className="form-result success";res.textContent="套餐已保存";toast("节点套餐已保存");$("#planFormPanel").hidden=true;loadPlans()}catch(e){res.className="form-result error";res.textContent=e.message||"保存失败"}finally{btn.disabled=false}});
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
async function loadNodes(){await Promise.allSettled([loadPlans(),loadNodeServers(),loadNodeOrders()])}
async function loadSupport(){
 const users=$("#chatUsersList"),ticketsBody=$("#ticketsBody");if(users)users.innerHTML='<div class="table-empty">正在读取客户会话…</div>';if(ticketsBody)ticketsBody.innerHTML='<tr><td colspan="7" class="table-empty">正在读取工单…</td></tr>';
 const [cr,tr]=await Promise.allSettled([legacyAdmin("/chat/users"),legacyAdmin("/tickets?status="+encodeURIComponent($("#ticketStatus")?.value||"")+"&page=1&size=50")]);
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
 $("#botsUpdated").textContent="正在读取服务器状态…";
 try{
  const data=await adminRequest("/api/admin/bots");
  (data.bots||[]).forEach(bot=>{
   const card=document.querySelector('[data-bot-card="'+bot.id+'"]');if(!card)return;
   const state=card.querySelector(".bot-state");const running=bot.status==="active";
   state.textContent=running?"运行中":bot.status==="inactive"?"已停止":bot.status||"未知";
   state.className="bot-state "+(running?"running":bot.status==="inactive"?"stopped":"pending");
   card.querySelector("[data-bot-pid]").textContent=bot.pid||"—";
   card.querySelector("[data-bot-enabled]").textContent=bot.enabled?"已启用":"未启用";
   card.querySelectorAll("[data-bot-action]").forEach(btn=>{btn.disabled=(btn.dataset.botAction==="start"&&running)||(btn.dataset.botAction==="stop"&&!running);});
  });
  $("#botsUpdated").textContent="最后更新："+new Date().toLocaleString("zh-CN");
 }catch(error){
  $("#botsUpdated").textContent="读取失败："+(error.message||"服务暂不可用");
  if(error.message==="invalid_token"||error.message==="token_expired"||error.message==="admin_forbidden"){localStorage.removeItem(TOKEN_KEY);document.body.classList.remove("authenticated")}
 }
}
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
