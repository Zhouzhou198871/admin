const API_BASE = "https://qingtian-shop-api.chulingli1988.workers.dev";
const $ = (selector) => document.querySelector(selector);
const pageNames = {overview:"总览",orders:"订单管理",users:"用户管理",products:"商品与库存",recharge:"余额充值"};
let toastTimer;
function toast(message){const el=$("#toast");el.textContent=message;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600)}
function showPage(name){if(!pageNames[name])return;document.querySelectorAll(".page").forEach(el=>el.classList.toggle("active",el.id==="page-"+name));document.querySelectorAll(".nav-item").forEach(el=>el.classList.toggle("active",el.dataset.page===name));$("#pageCrumb").textContent=pageNames[name];$("#sidebar").classList.remove("open");window.scrollTo({top:0,behavior:"smooth"})}
document.querySelectorAll(".nav-item").forEach(btn=>btn.addEventListener("click",()=>showPage(btn.dataset.page)));
document.querySelectorAll("[data-go]").forEach(btn=>btn.addEventListener("click",()=>showPage(btn.dataset.go)));
$("#menuToggle").addEventListener("click",()=>$("#sidebar").classList.toggle("open"));
$("#refreshBtn").addEventListener("click",checkApi);
async function checkApi(){
 const dot=$("#apiDot"),status=$("#apiStatus"),metric=$("#metricApi"),hint=$("#metricApiHint");
 dot.parentElement.classList.remove("ok","bad");status.textContent="正在检查 API";metric.textContent="检测中";
 try{const response=await fetch(API_BASE+"/health",{method:"GET",cache:"no-store"});if(!response.ok)throw new Error("HTTP "+response.status);const data=await response.json();if(!data.ok)throw new Error("health check failed");dot.parentElement.classList.add("ok");status.textContent="API 正常";metric.textContent="正常";hint.textContent="健康检查通过 · "+new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"});$("#apiHost").textContent="Worker · 在线";}
 catch(error){dot.parentElement.classList.add("bad");status.textContent="API 暂不可用";metric.textContent="未连接";hint.textContent="请检查 API 地址、服务状态及 CORS";$("#apiHost").textContent="Worker · 未连接";}
}
document.querySelectorAll("[data-amount]").forEach(btn=>btn.addEventListener("click",()=>{$("#creditAmount").value=btn.dataset.amount}));
$("#creditForm").addEventListener("submit",async event=>{
 event.preventDefault();
 const key=$("#adminKey").value.trim(),email=$("#creditEmail").value.trim().toLowerCase(),amount=$("#creditAmount").value.trim(),result=$("#creditResult"),submit=$("#creditSubmit");
 result.className="form-result";result.textContent="";
 if(!key){result.classList.add("error");result.textContent="请输入管理员 API 密钥。";return;}
 if(!/^\d{1,10}(\.\d{1,4})?$/.test(amount)||Number(amount)<=0){result.classList.add("error");result.textContent="金额格式不正确，最多支持 4 位小数。";return;}
 const confirmed=window.confirm("确认向 "+email+" 充值 "+Number(amount).toFixed(4)+" USDT？此操作会真实增加用户余额。");
 if(!confirmed)return;
 submit.disabled=true;submit.textContent="正在提交…";
 try{
  const response=await fetch(API_BASE+"/api/admin/credit",{method:"POST",headers:{"Content-Type":"application/json","X-Admin-Key":key},body:JSON.stringify({email,amount_usdt:Number(amount).toFixed(4)})});
  let data={};try{data=await response.json()}catch{}
  if(!response.ok||!data.ok){const message=data.error==="unauthorized"?"管理员密钥无效或未配置。":data.error==="user_not_found"?"未找到该邮箱对应的用户。":(data.error||"充值失败，请稍后重试。");throw new Error(message);}
  result.classList.add("success");result.textContent="充值请求已成功处理。用户："+email+" · 金额："+Number(amount).toFixed(4)+" USDT";
  $("#creditAmount").value="";toast("余额充值成功");
 }catch(error){result.classList.add("error");result.textContent=error.message||"请求失败，请检查网络与 API 状态。";}
 finally{submit.disabled=false;submit.innerHTML='确认充值 <span>→</span>';}
});
checkApi();
