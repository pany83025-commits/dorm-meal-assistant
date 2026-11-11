
const RAW=JSON.parse(document.getElementById("d-foods").textContent);
const RCP=JSON.parse(document.getElementById("d-recipes").textContent);
let F=[],BY={};
function rebuildFoods(){
  F=RAW.map(function(r,i){
    return {id:i,n:r[0],cat:r[1],kcal:r[2],p:r[3],f:r[4],c:r[5],fib:r[6],un:r[7],ug:r[8],e:r[9],
      kw:r[10],kc:r[11],label:r[12],src:r[13],note:r[14],na:r[15],ca:r[16],fe:r[17],vc:r[18],chol:r[19]};
  });
  /* 自建食材用固定 id（≥1000），不再按数组下标现编：删掉中间一条，后面的不会整体前移 */
  const list=((typeof S!=="undefined"&&S&&S.myFood)||[]);
  const used={};
  list.forEach(function(x){if(+x.id>=1000)used[+x.id]=1});
  let next=1000;
  list.forEach(function(x){
    if(!(+x.id>=1000)){
      while(used[next])next++;
      x.id=next;used[next]=1;
    }
    F.push({id:x.id,n:x.n,cat:x.cat||"protein",kcal:+x.kcal||0,p:+x.p||0,f:+x.f||0,c:+x.c||0,fib:+x.fib||0,
      un:x.un||"份",ug:+x.ug||100,e:100,kw:365,kc:365,label:"净重",src:x.src||"自建食材（非成分表）",
      note:x.note||"",na:+x.na||0,ca:0,fe:0,vc:0,chol:0,my:true});
  });
  BY={};
  F.forEach(function(f){BY[f.n]=f});
  /* 库存/浪费条目补上食材名：以后 RAW 顺序变了也认得出来是谁 */
  if(typeof S!=="undefined"&&S){
    (S.inv||[]).forEach(function(x){if(!x.n&&F[x.id])x.n=F[x.id].n});
    (S.waste||[]).forEach(function(x){if(!x.n&&F[x.id])x.n=F[x.id].n});
  }
}
/* 统一入口：条目 → 食材（优先认名字，id 只作兜底） */
function foodOf(x){
  if(!x)return null;
  return (x.n&&BY[x.n])||F[x.id]||null;
}
function foodName(x){const f=foodOf(x);return f?f.n:""}

/* ===== 食材互认：同一类可以顶替（目前只处理食用油） =====
   宿舍里买什么油是随机的，但橄榄油/大豆油/花生油的热量差别 <2%，
   不该因为"食谱写了橄榄油"就判定你没油。 */
function isOil(n){const f=BY[n];return !!(f&&f.cat==="fat"&&/油$/.test(f.n))}
function stockOils(){
  return S.inv.filter(function(x){const f=foodOf(x);return f&&f.cat==="fat"&&/油$/.test(f.n)&&x.g>0.5})
    .sort(function(a,b){return b.g-a.g});
}
/* 这个食材用什么满足：自己有就自己，油类则用库存最多的那种油；都没有返回 null */
function supplyOf(n){
  if(invQty(n)>0)return n;
  if(isOil(n)){
    const oils=stockOils();
    if(oils.length)return foodName(oils[0]);
  }
  return null;
}
function haveIng(n){return !!supplyOf(n)}
function ALL(){
  const base=RCP.concat(S.myRcp||[]);
  (S.myDish||[]).forEach(function(d,k){
    base.push({n:d.n,c:"主",t:20,d:d.note||"",
      m:(d.i||[]).map(function(x){return x[0]}),o:[],s:d.s||[],
      chk:"",bad:"",tip:"",myDishIdx:k});
  });
  return base;
}
const ALIAS={"柚子":"柚","蒜":"大蒜","蒜头":"大蒜","芝麻":"芝麻子","藕":"莲藕","西红柿":"番茄","洋芋":"土豆","地瓜":"红薯","山芋":"红薯","圆白菜":"包菜","卷心菜":"包菜","洋白菜":"包菜","青菜":"小白菜","面条":"挂面","鸡胸":"鸡胸肉","柿子椒":"甜椒","西柚":"葡萄柚","薯仔":"土豆","白薯":"红薯","花菜":"菜花","白菜":"大白菜","豌豆尖":"豌豆苗","海带菜":"海带","酱油":"生抽","老醋":"醋","米醋":"醋","淀粉":"淀粉","生粉":"淀粉","荞麦面条":"荞麦面","荞面条":"荞麦面","荞麦冷面":"荞麦面","荞面":"荞麦面",
  "麻酱":"芝麻酱","红油":"辣椒油","辣油":"辣椒油","郫县豆瓣":"豆瓣酱","番茄沙司":"番茄酱",
  "番茄膏":"番茄酱","黄酒":"料酒","料理酒":"料酒","花椒粉":"花椒","孜然":"孜然粉","咖喱":"咖喱粉",
  "黑胡椒粉":"黑胡椒","白胡椒粉":"白胡椒","胡椒粉":"白胡椒","生姜粉":"姜粉","辣椒面":"辣椒面","蘸水":"辣椒面","蘸料":"辣椒面","麻辣蘸料":"辣椒面","干碟":"辣椒面","荞麦方便面":"荞麦面","荞麦拌面":"荞麦面","乳清蛋白":"乳清蛋白粉","蛋白粉":"乳清蛋白粉","whey":"乳清蛋白粉","青椒":"青椒","红椒":"甜椒","豆芽":"豆芽"};
function nameHit(f,kw){
  if(!kw)return true;
  if(f.n.indexOf(kw)>-1||f.src.indexOf(kw)>-1)return true;
  const t=ALIAS[kw];
  return !!(t&&f.n.indexOf(t)>-1);
}
const DISH=JSON.parse(document.getElementById("d-dishes").textContent);
const CAT={protein:"蛋白",carb:"主食",veg:"蔬菜",fruit:"水果",fat:"油脂",dessert:"甜点",drink:"饮品",other:"调味"};
const APP_VER="3.14";              /* 发版只改这一处：关于页、SW 注册参数都读它 */
const K='dorm-eat-v2';
let S=load();
S.myFood=S.myFood||[];
rebuildFoods();

/* ---------- 顶部提示条（保存失败 / 新版本 / 数据修复共用） ---------- */
function notice(msg,opt){
  opt=opt||{};
  let el=document.getElementById("notice");
  if(!el){el=document.createElement("div");el.id="notice";el.setAttribute("role","status");el.setAttribute("aria-live","polite");document.body.appendChild(el)}
  el.className="notice"+(opt.warn?" warn":"");
  el.innerHTML='<span style="flex:1;min-width:0">'+msg+'</span>'+(opt.action?'<button>'+opt.action+'</button>':"");
  if(opt.action){el.querySelector("button").onclick=opt.onAction||hideNotice}
  /* 点文字也能收起，避免存储满载时的常驻条永久压住标题 */
  el.querySelector("span").onclick=hideNotice;
  void el.offsetWidth;
  el.classList.add("on");
  if(notice._t)clearTimeout(notice._t);
  if(!opt.sticky)notice._t=setTimeout(hideNotice,opt.ms||6500);
}
function hideNotice(){const el=document.getElementById("notice");if(el)el.classList.remove("on")}

/* ===== 可访问性：不侵入渲染逻辑，render 后统一补语义 ===== */
function a11yPatch(scope){
  const root=scope||document.getElementById("view");
  if(!root)return;
  root.querySelectorAll("[onclick]").forEach(function(el){
    if(/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(el.tagName))return;
    if(!el.hasAttribute("role"))el.setAttribute("role","button");
    if(!el.hasAttribute("tabindex"))el.setAttribute("tabindex","0");
  });
  /* label.fl 没有 for，把文字补成相邻输入框的 aria-label */
  root.querySelectorAll("label.fl").forEach(function(lb){
    const t=(lb.textContent||"").trim();
    if(!t)return;
    const nx=lb.nextElementSibling;
    if(!nx)return;
    const f=nx.matches("input,select,textarea")?nx:nx.querySelector("input,select,textarea");
    if(f&&!f.getAttribute("aria-label"))f.setAttribute("aria-label",t);
  });
  if(root.id==="view"){
    document.querySelectorAll("nav button").forEach(function(b){
      if(b.classList.contains("on"))b.setAttribute("aria-current","page");
      else b.removeAttribute("aria-current");
    });
  }
}
/* 键盘能操作「长得像按钮的 div」 */
document.addEventListener("keydown",function(e){
  if(e.key!=="Enter"&&e.key!==" ")return;
  const el=document.activeElement;
  if(!el||el.getAttribute("role")!=="button")return;
  if(/^(BUTTON|A|INPUT|SELECT|TEXTAREA)$/.test(el.tagName))return;
  e.preventDefault();el.click();
});

/* ---------- 状态：默认值 + 迁移 ---------- */
function defaultState(){
  return {v:3,inv:[],logs:[],waste:[],myRcp:[],myDish:[],myFood:[],nextFoodId:1000,shop:[],lastUpd:0,ai:{},
    set:{sex:"女",height:165,age:22,weight:60,act:1.375,kcal:1470,protein:96,fat:48,carb:163,
         na:2000,locked:false,city:"",lat:null,lon:null,offset:3},
    w:{t:null,avg3:null,src:"init",at:0}};
}
/* 老备份 / 残缺数据一律补全默认值：缺 set、缺 waste 都不会再白屏 */
function mergeState(r){
  const d=defaultState();
  if(!r||typeof r!=="object")return d;
  const out=Object.assign(d,r);
  out.set=Object.assign(defaultState().set,r.set||{});
  out.ai=Object.assign({},r.ai||{});
  out.w=Object.assign(defaultState().w,r.w||{});
  ["inv","logs","waste","myRcp","myDish","myFood","shop"].forEach(function(k){if(!Array.isArray(out[k]))out[k]=[]});
  out.v=3;
  return out;
}
function load(){
  let raw=null;
  try{raw=localStorage.getItem(K)}catch(e){}
  if(!raw)return defaultState();
  try{
    const r=JSON.parse(raw);
    if(r&&r.inv)return mergeState(r);
  }catch(e){}
  /* 解析失败：绝不就地覆盖，先留一份原始串，再进空状态 */
  try{localStorage.setItem(K+".broken",raw)}catch(e){}
  setTimeout(function(){
    notice("本机数据读不出来，原始内容已存为 "+K+".broken。可到「设置 → 数据」恢复备份，或清空重来。",{warn:true,sticky:true});
  },0);
  return defaultState();
}
let saveWarned=false;
function save(){
  try{
    localStorage.setItem(K,JSON.stringify(S));
    if(saveWarned){saveWarned=false;hideNotice()}   /* 存储恢复后自动收起警告条 */
  }catch(e){
    if(saveWarned)return;
    saveWarned=true;
    setTimeout(function(){
      notice("保存失败：本机存储已满或被系统禁用。<b>现在就去导出备份</b>，否则重启后这次记录会丢。",
        {warn:true,sticky:true,action:"去导出",onAction:function(){hideNotice();setTab("set");openSetData()}});
    },0);
  }
}
function dstr(d){const x=new Date(d);return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0")}
function today(){return dstr(new Date())}
function daysAgo(s){const a=new Date(s+"T00:00:00"),b=new Date(today()+"T00:00:00");return Math.round((b-a)/864e5)}
function calcTargets(){
  const s=S.set;if(s.locked)return;
  const bmr=10*s.weight+6.25*s.height-5*s.age+(s.sex==="男"?5:-161);
  const tdee=bmr*s.act;
  s.kcal=Math.max(1200,Math.round(tdee-400));
  s.protein=Math.round(s.weight*1.6);
  s.fat=Math.round(s.weight*0.8);
  s.carb=Math.max(0,Math.round((s.kcal-4*s.protein-9*s.fat)/4));
}
function roomT(){const o=+S.set.offset;return S.w.t==null?null:S.w.t+(isNaN(o)?3:o)}  /* 偏移填 0 要生效，别被 || 当成空值 */
function keepDays(f){
  const rt=roomT();
  if(rt==null){const m=new Date().getMonth()+1;return (m>=6&&m<=9)?f.kw:f.kc}
  let b;
  if(rt<=10)b=Math.floor(f.kc*1.2);else if(rt<=20)b=f.kc;else if(rt<=26)b=Math.floor((f.kc+f.kw)/2);
  else if(rt<=32)b=f.kw;else b=Math.floor(f.kw*0.8);
  return Math.max(0,b);
}
function remDays(it){const f=foodOf(it);return (f?keepDays(f):0)-daysAgo(it.d)}
function invQty(name){return S.inv.filter(x=>foodName(x)===name).reduce((a,b)=>a+b.g,0)}
function invItem(id){const f=F[id];return f?invQty(f.n):0}
function expireList(){return S.inv.filter(x=>foodOf(x)).map(x=>({...x,rem:remDays(x)})).filter(x=>x.rem<=0).sort((a,b)=>a.rem-b.rem)}
function eatenToday(){
  const t=today();
  return S.logs.filter(l=>l.d===t).reduce((a,l)=>({kcal:a.kcal+(l.kcal||0),p:a.p+(l.p||0),f:a.f+(l.f||0),c:a.c+(l.c||0),na:a.na+(l.na||0),veg:a.veg+(l.veg||0)}),{kcal:0,p:0,f:0,c:0,na:0,veg:0});
}
function rcpMacro(r){
  let k=0,p=0,f=0,c=0,na=0;
  r.m.forEach(n=>{const x=BY[n];if(!x)return;const g=x.ug;k+=x.kcal*g/100;p+=x.p*g/100;f+=x.f*g/100;c+=x.c*g/100;na+=(x.na||0)*g/100});
  return {kcal:Math.round(k),p:Math.round(p),f:Math.round(f),c:Math.round(c),na:Math.round(na)};
}
function macOfRcp(r){
  if(r.myDishIdx==null)return rcpMacro(r);
  const d=(S.myDish||[])[r.myDishIdx];
  if(!d)return rcpMacro(r);
  let k=0,p=0,f=0,c=0,g=0,na=0;
  (d.i||[]).forEach(function(it){
    const x=BY[it[0]];if(!x)return;
    k+=x.kcal*it[1]/100;p+=x.p*it[1]/100;f+=x.f*it[1]/100;c+=x.c*it[1]/100;g+=it[1];na+=(x.na||0)*it[1]/100;
  });
  return {kcal:Math.round(k),p:Math.round(p),f:Math.round(f),c:Math.round(c),g:Math.round(g),na:Math.round(na)};
}
function recommend(kw){
  const k=String(kw||"").trim();
  const exp=expireList().map(foodName);
  const recent={};S.logs.filter(l=>daysAgo(l.d)<=2).forEach(l=>{const n=l.name.split("（")[0];recent[n]=(recent[n]||0)+1});
  const now=[],near=[];
  ALL().forEach((r,i)=>{
    if(k){
      const hay=[r.n].concat(r.m||[]).concat(r.o||[]).join("|");
      if(hay.indexOf(k)<0)return;
    }
    const miss=r.m.filter(n=>!haveIng(n));
    let sc=r.m.length*2+(r.o||[]).filter(haveIng).length;
    miss.forEach(n=>{if(exp.indexOf(n)>-1)sc+=3});
    r.m.forEach(n=>{if(exp.indexOf(n)>-1)sc+=6});
    const mac=macOfRcp(r);
    sc+=mac.p/8;
    if(recent[r.n])sc-=recent[r.n]*4;
    if(r.t>25)sc-=1;
    const item={i,sc,mac,miss,r};
    if(!miss.length)now.push(item);
    else if(k||(miss.length<=2&&r.m.length>miss.length))near.push(item);
  });
  now.sort((a,b)=>b.sc-a.sc);near.sort((a,b)=>a.miss.length-b.miss.length||b.sc-a.sc);
  return {now:now.slice(0,k?40:4),near:near.slice(0,k?20:3),kw:k};
}
