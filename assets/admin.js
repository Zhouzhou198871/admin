"use strict";
const API_BASE="https://api.lynli.me";
const TOKEN_KEY="qingtian_shop_token";
const $=s=>document.querySelector(s);
const REMEMBER_EMAIL_KEY="qingtian_admin_remembered_email";
const rememberedEmail=localStorage.getItem(REMEMBER_EMAIL_KEY);
if(rememberedEmail){$("#loginEmail").value=rememberedEmail;$("#rememberPassword").checked=true}
const pageNames={overview:"总览",orders:"订单管理",users:"用户管理",products:"商品与库存",recharge:"余额充值",bots:"机器人管理"};
let toastTimer;
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600)}
function authHeaders(extra={}){return {...extra,Authorization:"Bearer "+(localStorage.getItem(TOKEN_KEY)||"")}}
async function adminRequest(path,options={}){const response=await fetchWithTimeout(API_BASE+path,{...options,headers:authHeaders(options.headers||{})},12000);let data={};try{data=await response.json()}catch{}if(!response.ok||Number(data.code)!==1)throw new Error(data.msg||data.message||data.error||(response.status===401?"unauthorized":"request_failed"));return data.data??data}
async function verifyAdmin(){const token=localStorage.getItem(TOKEN_KEY);if(!token){document.body.classList.remove("authenticated");return false}try{await adminRequest("/api/v1/admin/dashboard");document.body.classList.add("authenticated");return true}catch(error){const denied=["unauthorized","invalid_token","token_expired","admin_forbidden"].includes(error.message);if(denied)localStorage.removeItem(TOKEN_KEY);document.body.classList.remove("authenticated");$("#loginError").textContent=denied?"登录状态已失效，请重新登录。":"暂时无法连接验证服务，请检查网络后重试。";return false}}
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
  const response=await fetchWithTimeout(API_BASE+"/api/v1/passport/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})});
  const data=await response.json();if(!response.ok||!data.data?.token)throw new Error(data.message||data.msg||"invalid_credentials");
  localStorage.setItem(TOKEN_KEY,data.data.token);err.textContent="账号验证通过，正在确认管理员权限…";btn.textContent="确认管理权限…";
  await adminRequest("/api/v1/admin/dashboard");
  if(remember&&window.PasswordCredential&&navigator.credentials&&navigator.credentials.store){try{await navigator.credentials.store(new PasswordCredential({id:email,password,name:"晴天账号铺管理后台"}))}catch(saveError){console.info("Browser password manager did not accept the credential",saveError)}}
  if(!remember)$("#loginPassword").value="";$("#loginScreen").hidden=true;document.body.classList.add("authenticated");err.textContent="";checkApi();showPage("overview");
 }catch(error){
  localStorage.removeItem(TOKEN_KEY);
  err.textContent=error.message==="admin_forbidden"||error.message==="unauthorized"?"此账号尚未获得管理员权限。":error.message==="invalid_credentials"?"邮箱或密码不正确。":error.message||"登录失败，请稍后重试。";
 }finally{btn.disabled=false;btn.innerHTML='登录管理后台'}
});

$("#togglePassword").addEventListener("click",()=>{const input=$("#loginPassword"),button=$("#togglePassword"),show=input.type==="password";input.type=show?"text":"password";button.textContent=show?"隐藏":"显示";button.setAttribute("aria-label",show?"隐藏密码":"显示密码");button.setAttribute("aria-pressed",String(show));});

$("#logoutBtn").addEventListener("click",()=>{localStorage.removeItem(TOKEN_KEY);document.body.classList.remove("authenticated");$("#loginPassword").value="";});
function showPage(name){if(!pageNames[name])return;document.querySelectorAll(".page").forEach(el=>{const active=el.id==="page-"+name;el.classList.toggle("active",active);el.setAttribute("aria-hidden",String(!active))});document.querySelectorAll(".nav-item").forEach(el=>{const active=el.dataset.page===name;el.classList.toggle("active",active);if(active)el.setAttribute("aria-current","page");else el.removeAttribute("aria-current")});$("#pageCrumb").textContent=pageNames[name];$("#sidebar").classList.remove("open");$("#menuToggle").setAttribute("aria-expanded","false");window.scrollTo({top:0,behavior:"smooth"});if(name==="bots")loadBots();if(name==="overview")loadOverview();if(name==="orders")loadOrders();if(name==="users")loadUsers();if(name==="products")loadProducts()}
document.querySelectorAll(".nav-item").forEach(btn=>btn.addEventListener("click",()=>showPage(btn.dataset.page)));
document.querySelectorAll("[data-go]").forEach(btn=>btn.addEventListener("click",()=>showPage(btn.dataset.go)));
$("#menuToggle").addEventListener("click",()=>{const open=$("#sidebar").classList.toggle("open");$("#menuToggle").setAttribute("aria-expanded",String(open))});
$("#refreshBtn").addEventListener("click",checkApi);
async function checkApi(){const dot=$("#apiDot"),status=$("#apiStatus"),metric=$("#metricApi"),hint=$("#metricApiHint");dot.parentElement.classList.remove("ok","bad");status.textContent="正在检查 API";metric.textContent="检测中";try{const r=await fetchWithTimeout(API_BASE+"/api/v1/admin/dashboard",{headers:authHeaders(),cache:"no-store"},8000);let d={};try{d=await r.json()}catch{}if(!r.ok&&r.status!==401)throw Error(d.msg||"API unavailable");if(r.ok&&Number(d.code)!==1)throw Error(d.msg||"API unavailable");dot.parentElement.classList.add("ok");status.textContent="API 正常";metric.textContent="正常";hint.textContent=(r.status===401?"接口已连接 · 等待登录":"管理 API 已验证")+" · "+new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"});$("#apiHost").textContent="api.lynli.me · 在线"}catch(error){dot.parentElement.classList.add("bad");status.textContent="API 暂不可用";metric.textContent="未连接";hint.textContent=error.message||"服务暂时无响应";$("#apiHost").textContent="API · 未连接"}}
document.querySelectorAll("[data-amount]").forEach(btn=>btn.addEventListener("click",()=>{$("#creditAmount").value=btn.dataset.amount}));
$("#creditForm").addEventListener("submit",async e=>{e.preventDefault();const email=$("#creditEmail").value.trim().toLowerCase(),amount=$("#creditAmount").value.trim(),result=$("#creditResult"),submit=$("#creditSubmit");result.className="form-result";result.textContent="";if(!/^\d{1,10}(\.\d{1,4})?$/.test(amount)||Number(amount)<=0){result.classList.add("error");result.textContent="金额格式不正确，最多支持 4 位小数。";return}if(!confirm("确认向 "+email+" 充值 "+Number(amount).toFixed(4)+" USDT？此操作会真实增加用户余额。"))return;submit.disabled=true;submit.textContent="正在提交…";try{const data=await adminRequest("/api/admin/credit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,amount_usdt:Number(amount).toFixed(4)})});result.classList.add("success");result.textContent="充值成功。用户："+email+" · 金额："+Number(amount).toFixed(4)+" USDT";$("#creditAmount").value="";toast("余额充值成功")}catch(error){result.classList.add("error");result.textContent=error.message==="unauthorized"?"管理员身份验证已失效，请重新登录。":error.message||"请求失败";if(error.message==="unauthorized"){localStorage.removeItem(TOKEN_KEY);document.body.classList.remove("authenticated")}}finally{submit.disabled=false;submit.innerHTML='确认充值'}});


function escapeHtml(value){return String(value??"").replace(/[&<>"']/g,ch=>{if(ch==="&")return "&amp;";if(ch==="<")return "&lt;";if(ch===">")return "&gt;";if(ch==='"')return "&quot;";return "&#39;"})}
function formatAdminDate(value){
 if(value===null||value===undefined||value==="")return "—";
 const n=Number(value),d=Number.isFinite(n)&&String(value).trim()!==""?new Date(n<1000000000000?n*1000:n):new Date(value);
 return Number.isNaN(d.getTime())?"—":d.toLocaleString("zh-CN",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
}
function statusText(status){return ({pending:"待处理",reserved:"已预留",delivered:"已交付",refunded:"已退款",failed:"失败",processing:"处理中",paid:"已支付",cancelled:"已取消",expired:"已过期",provisioning:"配置中",active:"可用",inactive:"已停用"})[String(status||"").toLowerCase()]||String(status||"未知")}
function statusPill(status){const value=String(status||"").toLowerCase();const cls=["delivered","paid","active"].includes(value)?"good":["failed","refunded","cancelled","expired","inactive"].includes(value)?"bad":"wait";return '<span class="status-pill '+cls+'">'+escapeHtml(statusText(value))+'</span>'}
async function loadOverview(){
 try{
  const overview=await adminRequest("/api/v1/admin/stats/overview");
  $("#metricOrders").textContent=Number(overview.orders_total||0).toLocaleString("zh-CN");
  $("#metricUsers").textContent=Number(overview.users_total||0).toLocaleString("zh-CN");
  $("#metricProducts").textContent="—";
  $("#metricOrders").title="商城订单总数 "+overview.orders_total;
  const hint=$("#metricApiHint");if(hint)hint.textContent="实时读取生产数据库";
 }catch(error){["#metricOrders","#metricUsers","#metricProducts"].forEach(id=>$(id).textContent="—");}
}
async function loadUsers(){
 const body=$("#usersBody");if(!body)return;body.innerHTML='<tr><td colspan="5" class="table-empty">正在读取用户数据…</td></tr>';
 const q=$("#userSearch")?.value.trim()||"";
 try{
  const data=await adminRequest("/api/admin/users?q="+encodeURIComponent(q)+"&limit=50&page=1");
  body.innerHTML=data.users.length?data.users.map(user=>'<tr><td><b>'+escapeHtml(user.email)+'</b></td><td>'+escapeHtml(user.nickname||"—")+'</td><td class="mono">'+escapeHtml(user.tg_user_id||"—")+'</td><td class="money">'+escapeHtml(Number(user.balance||0).toFixed(4))+' USDT</td><td>'+escapeHtml(formatAdminDate(user.created_at))+'</td></tr>').join(""):'<tr><td colspan="5" class="table-empty">没有找到匹配用户</td></tr>';
  $("#usersCount").textContent="共 "+Number(data.total||0).toLocaleString("zh-CN")+" 位用户";
 }catch(error){body.innerHTML='<tr><td colspan="5" class="table-empty error-text">读取失败：'+escapeHtml(error.message||"请求失败")+'</td></tr>';$("#usersCount").textContent="读取失败"}
}
async function loadOrders(){
 const body=$("#ordersBody");if(!body)return;body.innerHTML='<tr><td colspan="7" class="table-empty">正在读取订单数据…</td></tr>';
 const q=$("#orderSearch")?.value.trim()||"",status=$("#orderStatus")?.value||"";
 try{
  const data=await adminRequest("/api/admin/orders?q="+encodeURIComponent(q)+"&status="+encodeURIComponent(status)+"&limit=50");
  body.innerHTML=data.orders.length?data.orders.map(order=>'<tr><td class="mono">'+escapeHtml(order.order_id)+'</td><td>'+escapeHtml(order.order_type)+'</td><td>'+escapeHtml(order.email||order.user_id||"—")+'</td><td class="mono">'+escapeHtml(order.product_id||"—")+'</td><td class="money">'+escapeHtml(Number(order.amount||0).toFixed(4))+' USDT</td><td>'+statusPill(order.status)+'</td><td>'+escapeHtml(formatAdminDate(order.created_at))+'</td></tr>').join(""):'<tr><td colspan="7" class="table-empty">暂无符合条件的订单</td></tr>';
  $("#ordersCount").textContent="当前显示 "+data.total_returned+" 条订单";
 }catch(error){body.innerHTML='<tr><td colspan="7" class="table-empty error-text">读取失败：'+escapeHtml(error.message||"请求失败")+'</td></tr>';$("#ordersCount").textContent="读取失败"}
}
async function loadProducts(){
 const body=$("#productsBody");if(!body)return;body.innerHTML='<tr><td colspan="7" class="table-empty">正在读取商品目录…</td></tr>';
 const q=$("#productSearch")?.value.trim()||"";
 try{
  const data=await adminRequest("/api/admin/products?q="+encodeURIComponent(q)+"&limit=50&page=1");
  body.innerHTML=data.products.length?data.products.map(product=>{
   const state=product.purchasable?"可购买":product.is_on_sale?"上架中":"未上架";
   return '<tr><td><b>'+escapeHtml(product.name)+'</b></td><td>'+escapeHtml(product.category_name||"—")+'</td><td class="mono">'+escapeHtml(product.product_id)+'</td><td class="money">'+escapeHtml(Number(product.price_usdt||0).toFixed(4))+' USDT</td><td>'+escapeHtml(Number(product.stock||0).toLocaleString("zh-CN"))+'</td><td>'+statusPill(product.purchasable?"active":"inactive")+' <small class="muted-inline">'+escapeHtml(state)+'</small></td><td>'+escapeHtml(formatAdminDate(product.updated_at))+'</td></tr>';
  }).join(""):'<tr><td colspan="7" class="table-empty">没有找到匹配商品</td></tr>';
  $("#productsCount").textContent="目录共 "+Number(data.total||0).toLocaleString("zh-CN")+" 件商品（当前显示 "+data.products.length+" 件）";
 }catch(error){body.innerHTML='<tr><td colspan="7" class="table-empty error-text">读取失败：'+escapeHtml(error.message||"请求失败")+'</td></tr>';$("#productsCount").textContent="读取失败"}
}
$("#ordersRefresh")?.addEventListener("click",loadOrders);
$("#orderSearchBtn")?.addEventListener("click",loadOrders);
$("#orderStatus")?.addEventListener("change",loadOrders);
$("#usersRefresh")?.addEventListener("click",loadUsers);
$("#userSearchBtn")?.addEventListener("click",loadUsers);
$("#userSearch")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();loadUsers()}});
$("#productsRefresh")?.addEventListener("click",loadProducts);
$("#productSearchBtn")?.addEventListener("click",loadProducts);
$("#productSearch")?.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();loadProducts()}});

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
(async()=>{const authenticated=await verifyAdmin();checkApi();if(authenticated)loadOverview()})();
