
let tab="today",q="",rcpFilter="all",foodQ="";
const view=document.getElementById("view");
const $=id=>document.getElementById(id);

async function loadWeather(force){
  const w=S.w||{};
  if(!force&&w.at&&Date.now()-w.at<3*3600e3)return;
  if(S.set.lat==null||S.set.lon==null)return;
  try{
    const u=`https://api.open-meteo.com/v1/forecast?latitude=${S.set.lat}&longitude=${S.set.lon}&current=temperature_2m&daily=temperature_2m_max&timezone=auto&forecast_days=3`;
    const r=await fetch(u);if(!r.ok)throw 0;
    const d=await r.json();
    const mx=(d.daily&&d.daily.temperature_2m_max)||[];
    S.w={t:d.current.temperature_2m,avg3:mx.length?mx.reduce((a,b)=>a+b,0)/mx.length:null,src:"live",at:Date.now()};
    save();render();
  }catch(e){S.w=S.w||{};S.w.src="fail";save();render()}
}
async function geocode(city){
  const u=`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=zh&format=json`;
  const r=await fetch(u);if(!r.ok)throw 0;
  const d=await r.json();
  if(!d.results||!d.results.length)throw 1;
  return d.results[0];
}

function subHtml(){
  const rt=roomT();
  let a='<span>600W · 无冰箱 · 净重口径</span>';
  if(rt!=null){
    const lag=S.w&&S.w.at&&Date.now()-S.w.at>3*3600e3?"（旧）":"";
    a+=`<span class="w">气温 ${S.w.t.toFixed(0)}℃ · 室温估 ${rt.toFixed(0)}℃${lag}</span>`;
  }else a+='<span class="w off">未设城市 · 按季节估算</span>';
  return a;
}
function bar(lb,val,max,color){
  const pct=max>0?Math.min(100,val/max*100):0;
  return `<div class="bar-row"><span class="lb">${lb}</span><div class="tr"><div class="fl" style="width:${pct}%;background:${color}"></div></div><span class="vl">${Math.round(val)}/${max}</span></div>`;
}
function macLine(m){return `${m.kcal} kcal · 蛋白 ${m.p}g · 碳水 ${m.c}g · 脂肪 ${m.f}g`}

function dailyBrief(){
  const e=eatenToday(), sg=S.set;
  const logs=S.logs.filter(function(l){return l.d===today()});
  const now=new Date().getHours();
  const phase=now<10?"早上":now<14?"上午":now<18?"下午":now<22?"晚上":"深夜";
  const kLeft=Math.round(sg.kcal-e.kcal);
  const pLeft=Math.max(0,Math.round(sg.protein-e.p));
  const exp=expireList();
  let head="",body=[],advice="";
  if(!logs.length){
    head="今天还没记录";
    body.push(now<11?"现在是"+phase+"，早餐吃了什么？":"今天一条记录都还没有。");
    advice = now<11 ? "先记早餐，再决定中午吃多少。"
           : now<16 ? "补记早餐和午餐，晚上才有余量可算。"
           : "今天快过去了，至少把晚上这顿记上，明天才有基线。";
  }else{
    head="已摄入 "+Math.round(e.kcal)+" / "+sg.kcal+" kcal（"+Math.round(sg.kcal>0?e.kcal/sg.kcal*100:0)+"%）";
    body.push("蛋白 "+Math.round(e.p)+" / "+sg.protein+"g"+(pLeft>0?"（还差 "+pLeft+"g）":"（已达标）")
      +"　｜　钠 "+Math.round(e.na)+"mg"+(e.na>2000?"（已超 2000 上限）":""));
    if(kLeft>150){
      advice=(phase==="晚上"||phase==="深夜")
        ? "还剩 "+kLeft+" kcal，但已经不早了，别补主食，饿了吃点蛋白或蔬菜。"
        : "还有 "+kLeft+" kcal 余量，够一顿正常的主食 + 蛋白 + 蔬菜。";
    }else if(kLeft>0){
      advice="热量快满了，接下来优先补蛋白和蔬菜，主食减半。";
    }else{
      advice="热量已超 "+Math.abs(kLeft)+" kcal，剩下时间只吃蔬菜和蛋白，别再碰主食和油。";
    }
    if(pLeft>25&&kLeft>200) advice+="　蛋白还差 "+pLeft+"g，优先一份鸡胸/虾仁/豆腐，比再吃一碗饭有用。";
    if(e.na>2000) advice="钠超过 2000mg，明天生抽减半、多喝水；明早体重虚涨别慌，是水不是脂肪。";
  }
  if(exp.length){
    const f=BY[F[exp[0].id].n];
    body.push("库存："+f.n+(exp[0].rem<=0?"今天必须吃掉":"还剩 "+exp[0].rem+" 天")+(exp.length>1?"，另有 "+(exp.length-1)+" 样临期":""));
  }
  return '<div class="card"><h2>今日简报<span>'+phase+'</span></h2>'
    +'<div style="font-size:13px;line-height:1.8">'
    +'<div style="font-weight:500;font-size:14px;margin-bottom:5px">'+head+'</div>'
    +body.map(function(x){return '<div style="color:var(--ink2)">'+x+'</div>'}).join("")
    +'<div style="margin-top:10px;padding:10px 12px;background:var(--gl);border-radius:9px;color:var(--ok-ink);line-height:1.7">'+advice+'</div>'
    +'</div></div>';
}
function renderToday(){
  const e=eatenToday(),exp=expireList(),rec=recommend();
  const sg=S.set;
  const pLeft=Math.round(sg.protein-e.p),kLeft=Math.round(sg.kcal-e.kcal);
  let advise="";
  if(exp.length){
    const f=BY[F[exp[0].id].n],r=exp[0].rem;
    advise=r<0?`<b>${f.n}</b> 已过期 ${-r} 天，别再吃了。`:`<b>${f.n}</b> ${r===0?"今天是最后一天":"还剩 "+r+" 天"}，优先用掉。`;
  }else if(pLeft>20)advise=`今天蛋白还差 <b>${pLeft}g</b>，下一餐优先补一份蛋白。`;
  else if(kLeft>300)advise=`蛋白够了，热量还有 <b>${kLeft} kcal</b> 余量，可以安排主食和蔬菜。`;
  else advise=`今天的缺口基本填满了，加餐别再加主食。`;

  let h=dailyBrief()+`<div class="card"><h2>今日摄入<span>${today()}</span></h2><div class="bars">
    ${bar("热量",e.kcal,sg.kcal,"#3B6D11")}
    ${bar("蛋白",e.p,sg.protein,"#1D9E75")}
    ${bar("碳水",e.c,sg.carb,"#378ADD")}
    ${bar("脂肪",e.f,sg.fat,"#BA7517")}
    ${bar("钠 mg",e.na,sg.na||2000,"#993C1D")}
  </div></div>
  <div class="tip ${exp.length?"":"ok"}">${exp.length?"⏳ ":"✓ "}${advise}</div>`;

  /* 今天吃了：紧接「今日摄入」下方，按餐次分组，点条目看明细、点标题看整天 */
  const tl=S.logs.filter(l=>l.d===today());
  if(tl.length){
    const tk=tl.reduce((a,l)=>a+(l.kcal||0),0);
    h+=`<div class="card"><h2 onclick="openDay(today())" style="cursor:pointer">今天吃了<span>${tl.length} 次 · ${Math.round(tk)} kcal ›</span></h2>`;
    ["早","午","晚","加",""].forEach(mk=>{
      const items=tl.filter(l=>(MEALS.indexOf(l.m)>=0?l.m:"")===mk);
      if(!items.length)return;
      const kk=items.reduce((a,l)=>a+(l.kcal||0),0);
      const pp=items.reduce((a,l)=>a+(l.p||0),0);
      const share=tk>0?Math.round(kk/tk*100):0;
      h+=`<div class="sec" style="margin:8px 0 2px"><b>${MEAL_LABEL[mk]}</b><span>${Math.round(kk)} kcal · ${share}% · 蛋白 ${Math.round(pp)}g</span></div>`;
      items.forEach(l=>{
        const li=S.logs.indexOf(l);
        h+=`<div class="food" onclick="openLogDetail(${li})"><div class="info">
          <div class="nm">${esc(l.name)}</div>
          <div class="mt">${Math.round(l.kcal)} kcal · 蛋白 ${Math.round(l.p)}g · 碳水 ${Math.round(l.c||0)}g · 脂肪 ${Math.round(l.f||0)}g</div>
        </div><span style="color:var(--ink4);font-size:16px">›</span></div>`;
      });
    });
    h+=`</div>`;
  }

  h+=`<div class="card"><h2>现在就能做<span>库存齐全 · ${rec.now.length} 道</span></h2>`;
  if(!rec.now.length)h+=`<div class="empty">库存还配不成一道完整的菜<br>去「食材」页加几样</div>`;
  rec.now.forEach(x=>{
    h+=`<div class="rec" onclick="openRcp(${x.i})">
      <div class="t"><b>${x.r.n}</b><em>${x.r.t} 分钟</em></div>
      <div class="d">${x.r.d||""}</div>
      <div class="mac">${macLine(x.mac)}</div>
      <div class="badges">${x.r.k?'<span class="badge mut">免开火</span>':''}
        ${x.r.m.filter(n=>exp.some(e2=>F[e2.id].n===n)).map(n=>`<span class="badge warn">用掉临期：${n}</span>`).join("")}
      </div></div>`;
  });
  h+=`</div>`;

  if(rec.near.length){
    h+=`<div class="card"><h2>差一样就能做<span>标的是需要买的</span></h2>`;
    rec.near.forEach(x=>{
      h+=`<div class="rec" onclick="openRcp(${x.i})">
        <div class="t"><b>${x.r.n}</b><em>${x.r.t} 分钟</em></div>
        <div class="mac">${macLine(x.mac)}</div>
        <div class="badges">${x.miss.map(n=>`<span class="badge warn">需买：${n}</span>`).join("")}</div>
      </div>`;
    });
    h+=`</div>`;
  }

  return h;
}

function rcpMatch(r,kw){
  if(!kw)return true;
  if(r.n.indexOf(kw)>-1)return true;
  if(r.m.some(n=>n.indexOf(kw)>-1))return true;
  return (r.o||[]).some(n=>n.indexOf(kw)>-1);
}
let newRcp={n:"",items:[],steps:"",idx:-1};
function openNewRcp(){newRcp={n:"",items:[],steps:"",idx:-1};sheetPushNext=1;renderNewRcp()}
function openEditDish(i){
  const d=(S.myDish||[])[i];
  if(!d){alert("没找到这条");return}
  newRcp={n:d.n||"",
    items:(d.i||[]).map(function(x){return {n:x[0],raw:x[0],g:x[1]}}),
    steps:(d.s||[]).join("\n"),idx:i};
  sheetPushNext=1;renderNewRcp();
}
function newRcpTotalText(){
  const m=dishMacro({i:newRcp.items.map(function(x){return [x.n,x.g]})},1);
  return '<div class="l"><b>合计</b><b>'+m.kcal+' kcal</b></div>'
    +'<div class="l"><span>约 '+m.g+'g · 蛋白 '+m.p+'g · 碳水 '+m.c+'g · 脂肪 '+m.f+'g · 钠 '+m.na+'mg</span></div>';
}
function recipePrompt(){
  const pool=F.filter(function(f){return !f.my}).map(function(f){return f.n}).join("、");
  return "请提取这份菜谱的信息。要求：\n"
    +"1. 食材名优先从下面列表里一字不改地选择："+pool+"\n"
    +"2. 列表里没有的，用菜谱里的原始叫法，不要硬套成别的名字\n"
    +"3. 菜谱写「适量/少许/一把」的，按常见份量估克数，并把 guess 标 true\n"
    +"4. 做法按顺序拆成一步一条，每条不超过 30 字\n"
    +"5. 只输出 JSON，不要任何解释\n\n"
    +'格式：{"name":"菜名","items":[{"name":"鸡胸肉","g":150,"guess":false}],"steps":["步骤1","步骤2"]}';
}
function pickRecipeImage(){
  if(!window.AndroidBridge||!AndroidBridge.pickImage){
    alert("截图识别要在 App 里用。浏览器或电脑上请用「粘贴文字解析」。");
    return;
  }
  grabForm();
  AndroidBridge.pickImage();
}
window.__imgCb=function(st){
  if(st!=="ok"){alert("没有选到图片");renderNewRcp();return}
  let b64="";
  try{b64=AndroidBridge.takePickedImage()}catch(e){}
  if(!b64){alert("读取图片失败");renderNewRcp();return}
  runRecognize("img","",b64);
};
function openPasteText(){
  grabForm();
  openSheet('<h3>粘贴文字解析</h3><div class="sm">把刷到的文字复制进来，AI 帮你拆成食材和步骤</div>'
    +'<textarea id="paste_txt" style="min-height:150px" placeholder="把菜谱文字粘在这里…"></textarea>'
    +'<div style="height:12px"></div><button class="btn" onclick="runPasteParse()">开始解析</button>'
    +'<div style="height:8px"></div><button class="btn ghost" onclick="renderNewRcp()">返回</button>');
}
function runPasteParse(){
  const t=(document.getElementById("paste_txt")||{}).value||"";
  if(t.trim().length<10){alert("文字太短，至少粘一段做法");return}
  runRecognize("text",t.slice(0,4000),"");
}
function runRecognize(kind,text,b64){
  if(!S.ai||!S.ai.key){alert("需要先在「记录」页填 AI 接口和 Key");return}
  const tip=kind==="img"?"正在识别截图…图片通常 5–15 秒":"正在解析文字…通常 3–8 秒";
  openSheet('<h3>识别中</h3><div class="empty loading"><span class="spinner"></span>'+tip+'</div>');
  let content;
  if(kind==="img"){
    content=[{type:"text",text:recipePrompt()},
             {type:"image_url",image_url:{url:"data:image/jpeg;base64,"+b64}}];
  }else{
    content=[{type:"text",text:recipePrompt()+"\n\n菜谱原文：\n"+text}];
  }
  const payload={model:(S.ai.model||"deepseek-flash"),temperature:0.3,max_tokens:1600,
    messages:[{role:"user",content:content}],
    response_format:{type:"json_object"}};
  aiPost(payload,function(t){handleRecipe(t)});
}
function aiContentOf(t){
  const d=JSON.parse(t);
  let c=(d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content)||"";
  c=c.replace(/^```(?:json)?/i,"").replace(/```$/,"").trim();
  const i=c.indexOf("{"),j=c.lastIndexOf("}");
  if(i>-1&&j>i)c=c.slice(i,j+1);
  return JSON.parse(c);
}
function handleRecipe(t){
  if(!t||String(t).indexOf("err:")===0){
    openSheet('<h3>识别失败</h3><div class="tip">'+esc(String(t||"").slice(0,200))+'</div>'
      +'<button class="btn ghost" onclick="renderNewRcp()">返回手填</button>');
    return;
  }
  let obj=null;
  try{obj=aiContentOf(t)}catch(e){
    openSheet('<h3>识别失败</h3><div class="tip">返回内容不是合法 JSON，再试一次或换文字粘贴</div>'
      +'<button class="btn ghost" onclick="renderNewRcp()">返回手填</button>');
    return;
  }
  const items=(obj.items||[]).map(function(x){
    const nm=String(x.name||x.n||"").trim();
    const g=Math.round(+(x.g||x.gram||0))||100;
    const mt=matchFood(nm);
    return {raw:nm,n:mt?mt.n:null,how:mt?mt.how:null,g:g,guess:!!x.guess};
  }).filter(function(x){return x.raw});
  if(!items.length){
    openSheet('<h3>没识别出食材</h3><div class="tip">这张图里没找到可用的食材清单，换一张更清晰的，或直接粘贴文字</div>'
      +'<button class="btn ghost" onclick="renderNewRcp()">返回手填</button>');
    return;
  }
  if(obj.name)newRcp.n=String(obj.name).trim();
  newRcp.items=items;
  newRcp.steps=(obj.steps||[]).map(function(x){return String(x)}).join("\n");
  aiSug={};
  const miss=items.filter(function(x){return !x.n}).map(function(x){return x.raw});
  renderNewRcp();
  if(miss.length)askSuggest(miss);
}
function askSuggest(names){
  if(!S.ai||!S.ai.key)return;
  aiSugBusy=true;renderNewRcp();
  const pool=F.filter(function(f){return !f.my}).map(function(f){return f.n}).join("、");
  const user="下面这些词在本地食材库里找不到。请从给定列表里为每个词挑选最接近的 1–3 个候选，按接近程度排序。\n\n"
    +"待匹配："+names.join("、")+"\n\n可选列表："+pool+"\n\n"
    +"要求：只输出 JSON；确实没有相近的就给空数组，不要硬凑。\n"
    +'格式：{"items":[{"raw":"鸡里脊","c":["鸡胸肉","鸡腿肉"],"why":"同一部位，脂肪接近"}]}';
  const payload={model:(S.ai.model||"deepseek-flash"),temperature:0.2,max_tokens:700,
    messages:[{role:"user",content:user}],response_format:{type:"json_object"}};
  aiPost(payload,function(t){
    aiSugBusy=false;
    try{
      const o=aiContentOf(t);
      (o.items||[]).forEach(function(x){
        const raw=String(x.raw||"").trim();
        const cs=(x.c||[]).filter(function(n){return BY[n]});
        if(raw&&cs.length)aiSug[raw]={c:cs,why:String(x.why||"")};
      });
    }catch(e){}
    renderNewRcp();
  });
}
let nfAI=false;
function openNewFood(name){
  nfAI=false;
  const has=name&&BY[name]&&!BY[name].my;
  if(has){
    /* 库里已经有就不必新建，直接给入口去用 */
    openSheet('<h3>'+esc(name)+'</h3><div class="sm">成分表里已经有这一条，直接用更准</div>'
      +'<div class="logitem"><span>'+esc(BY[name].n)+'</span><span class="r">'+BY[name].kcal+' kcal/100g</span></div>'
      +'<div style="font-size:12px;color:var(--ink3);margin-top:8px">来源：'+esc(BY[name].src)+'</div>'
      +'<div style="height:12px"></div><button class="btn" onclick="closeSheet();openAdd('+BY[name].id+')">用这一条（加进库存）</button>'
      +'<div style="height:8px"></div><button class="btn ghost" onclick="closeSheet()">关闭</button>');
    return;
  }
  grabForm();
  openSheet('<h3>新建食材</h3><div class="sm">先搜成分表；没有再自己录，或用 AI 估一个</div>'
    +'<label class="fl">名称</label><input type="search" id="nf_name" value="'+esc(name||"").replace(/"/g,"&quot;")+'" placeholder="比如 葡式蛋挞">'
    +'<div class="row3"><div><label class="fl">分类</label><select id="nf_cat">'
      +Object.keys(CAT).map(function(k){return '<option value="'+k+'"'+(k==="dessert"?" selected":"")+'>'+CAT[k]+'</option>'}).join("")
    +'</select></div>'
    +'<div><label class="fl">单位</label><input type="search" id="nf_un" value="个"></div></div>'
    +'<div class="row3"><div><label class="fl">1单位克数</label><input type="number" id="nf_ug" value="100" inputmode="decimal"></div>'
    +'<div><label class="fl">钠 mg</label><input type="number" id="nf_na" value="0" inputmode="decimal"></div></div>'
    +'<label class="fl">每 100g 热量 kcal（必填）</label><input type="number" id="nf_k" inputmode="decimal" placeholder="比如 300">'
    +'<div class="row3"><div><label class="fl">蛋白 g</label><input type="number" id="nf_p" value="0" inputmode="decimal"></div>'
    +'<div><label class="fl">脂肪 g</label><input type="number" id="nf_f" value="0" inputmode="decimal"></div></div>'
    +'<div class="row3"><div><label class="fl">碳水 g</label><input type="number" id="nf_c" value="0" inputmode="decimal"></div>'
    +'<div><label class="fl">膳食纤维 g</label><input type="number" id="nf_fib" value="0" inputmode="decimal"></div></div>'
    +'<div style="height:10px"></div><button class="btn ghost" onclick="aiFoodHint(true)">✦ 让 AI 估一份（按每 100g）</button>'
    +'<div id="nf_hint" style="margin-top:8px"></div>'
    +'<div style="height:12px"></div><button class="btn" onclick="saveNewFood()">保存这个食材</button>'
    +'<div style="height:8px"></div><button class="btn ghost" onclick="closeSheet()">取消</button>');
}
function aiFoodHint(){
  const nm=((document.getElementById("nf_name")||{}).value||"").trim();
  if(!nm){alert("先填名称");return}
  if(!S.ai||!S.ai.key){alert("需要先在「设置 → AI 写菜谱」填接口和 Key");return}
  const box=document.getElementById("nf_hint");
  if(box)box.innerHTML='<div class="empty loading"><span class="spinner"></span>正在估…</div>';
  const user="估算「"+nm+"」每 100 克可食部的营养成分。\n"
    +"这是给人记饮食用的，请按最常见的做法/配方给单点值（不是区间），并保证 4×蛋白+4×碳水+9×脂肪 与热量大致自洽。\n"
    +"若它是甜品、饮料、烘焙半成品，请在 kind 里标出。\n"
    +"只输出 JSON：{\"what\":\"一句话说明这是什么\",\"kind\":\"dessert|drink|protein|carb|veg|fruit|fat|other\","
    +"\"kcal\":数字,\"p\":数字,\"f\":数字,\"c\":数字,\"fib\":数字,\"na\":数字,"
    +"\"unit\":\"常见单位名，如个/杯/块\",\"ug\":\"该单位约多少克\",\"note\":\"依据与不确定点\"}";
  aiPost({model:(S.ai.model||"deepseek-flash"),temperature:0.2,max_tokens:500,
    messages:[{role:"user",content:user}],response_format:{type:"json_object"}},function(t){
    let o=null;
    try{o=aiContentOf(t)}catch(e){}
    const box2=document.getElementById("nf_hint");
    if(!box2)return;
    if(!o||!o.kcal){box2.innerHTML='<div class="tip">没拿到数据，试试换个更具体的名字（如「葡式蛋挞 一只 60g」）</div>';return}
    const num=function(v){const n=parseFloat(v);return isFinite(n)?Math.round(n*10)/10:0};
    const kcal=num(o.kcal),p=num(o.p),f=num(o.f),c=num(o.c);
    const calc=Math.round(4*p+4*c+9*f);
    const dev=kcal>0?Math.abs(calc-kcal)/kcal:0;
    box2.innerHTML='<div class="tip">'
      +esc(o.what||"")+'<br>'
      +'热量 '+kcal+' kcal　蛋白 '+p+'g　脂肪 '+f+'g　碳水 '+c+'g'
      +(o.fib?'　纤维 '+num(o.fib)+'g':'')+(o.na?'　钠 '+num(o.na)+'mg':'')
      +'<br>1'+(esc(o.unit||"份"))+'≈'+(num(o.ug)||100)+'g'
      +(o.note?'<br>'+esc(o.note):'')
      +(dev>0.3?'<br><b style="color:var(--a)">注意：宏量与热量差 '+(dev*100).toFixed(0)+'%，数值可疑</b>':'')
      +'<div style="margin-top:6px;color:var(--r)">AI 估的是典型值，不是实测。有包装标签以标签为准。</div>'
      +'</div><button class="add" style="padding:3px 10px;margin-top:6px" onclick="fillFoodHint('
      +kcal+','+p+','+f+','+c+','+num(o.fib)+',\''+esc(String(o.kind||"")).replace(/'/g,"")+'\',\''
      +esc(String(o.unit||"")).replace(/'/g,"")+'\','+(num(o.ug)||100)+','+num(o.na)+')">填入表单（仍可手改）</button>';
  });
}
function fillFoodHint(k,p2,f,c,fib,kind,unit,ug,na){
  const set=function(id,v){const e=document.getElementById(id);if(e!=null&&v!=null&&v!=="")e.value=v};
  set("nf_k",k);set("nf_p",p2);set("nf_f",f);set("nf_c",c);
  if(fib!=null)set("nf_fib",fib);
  if(na!=null)set("nf_na",na);
  if(unit)set("nf_un",unit);
  if(ug)set("nf_ug",ug);
  const cat=document.getElementById("nf_cat");
  if(cat&&kind&&CAT[kind])cat.value=kind;
  nfAI=true;
  const hint=document.getElementById("nf_hint");
  if(hint)hint.innerHTML+='<div class="tip ok" style="margin-top:6px">已填入，来源会记成「AI 估算」</div>';
}
function saveNewFood(){
  const g=function(id){const e=document.getElementById(id);return e?e.value:""};
  const name=String(g("nf_name")).trim();
  const kcal=parseFloat(g("nf_k"));
  if(!name){alert("先填名称");return}
  if(!(kcal>0)){alert("热量必填，而且要大于 0");return}
  if(BY[name]&&!BY[name].my){alert("库里已经有「"+name+"」了，直接用就行，不用新建");return}
  const catEl=document.getElementById("nf_cat");
  const cat=(catEl&&catEl.value)||"protein";
  const rec={n:name,cat:cat,kcal:kcal,p:+g("nf_p")||0,f:+g("nf_f")||0,c:+g("nf_c")||0,
    fib:+g("nf_fib")||0,na:+g("nf_na")||0,
    un:String(g("nf_un")||"份").trim()||"份",ug:+g("nf_ug")||100,
    src:nfAI?"AI 估算（未核对）":"自建食材（非成分表）",
    note:nfAI?"AI 按常见做法估的典型值，不是实测":"自建，数值未核对"};
  S.myFood=S.myFood||[];
  const idx=S.myFood.findIndex(function(x){return x.n===name});
  if(idx>-1){
    /* 同名覆盖＝编辑原食材，沿用原 id，库存/浪费里的引用才不会断 */
    const old=S.myFood[idx];
    if(+old.id>=1000)rec.id=old.id;
    S.myFood.splice(idx,1);
  }
  if(!(+rec.id>=1000)){
    const used={};
    S.myFood.forEach(function(x){if(+x.id>=1000)used[+x.id]=1});
    let nid=Math.max(1000,+(S.nextFoodId||1000));
    while(used[nid])nid++;
    rec.id=nid;S.nextFoodId=nid+1;
  }
  S.myFood.push(rec);
  rebuildFoods();save();
  const inRcp=typeof newRcp!=="undefined"&&newRcp&&newRcp.items&&newRcp.items.length;
  if(inRcp&&tab!=="food"){
    const target=newRcp.items.filter(function(x){return !x.n&&x.raw===name})[0]
              ||newRcp.items.filter(function(x){return !x.n})[0];
    if(target){target.n=name;target.how="新建"}
    sheetRedraw=1;renderNewRcp();
  }else{
    closeSheet();setTab("food");foodQ=name;render();
  }
  notice("已新建「"+name+"」，食材页和食谱里都能直接用");
}

let aiSug={},aiSugBusy=false;
function renderNewRcp(){
  sheetRedraw=1;
  const items=newRcp.items;
  const miss=items.filter(function(x){return !x.n});
  const editing=(newRcp.idx>-1);
  let h='<h3>'+(editing?"编辑菜谱":"自建菜谱")+'</h3><div class="sm">'
    +(editing?"改完点底部保存，直接覆盖原来那条":"可以手填，也可以从截图或文字导入")+'</div>';
  h+='<div class="btns" style="margin-bottom:4px">'
    +'<button class="btn ghost" onclick="pickRecipeImage()">从截图识别</button>'
    +'<button class="btn ghost" onclick="openPasteText()">粘贴文字解析</button></div>';
  h+='<label class="fl">菜名</label><input type="search" id="nr_name" value="'+esc(newRcp.n).replace(/"/g,"&quot;")+'" placeholder="比如 蒜香鸡胸（抖音版）" oninput="newRcp.n=this.value">';
  h+='<div class="sec"><b>食材</b><span>'+items.length+' 样'+(miss.length?' · '+miss.length+' 项待处理':'')+'</span></div>';
  if(!items.length)h+='<div class="empty">还没加食材</div>';
  if(aiSugBusy)h+='<div class="empty loading"><span class="spinner"></span>正在为缺失的食材找候选…</div>';
  items.forEach(function(x,i){
    const ok=!!x.n;
    const f=ok?BY[x.n]:null;
    h+='<div style="border:1px solid '+(ok?'var(--line)':'var(--r-line)')+';border-radius:10px;padding:9px 11px;margin-bottom:7px;background:'+(ok?'#fff':'#FDF6F6')+'">'
      +'<div style="display:flex;align-items:center;gap:8px">'
      +'<span style="flex:1;font-size:14px;font-weight:500">'+esc(ok?x.n:x.raw)
      +(x.guess?' <span class="badge warn">克数是估的</span>':'')+'</span>'
      +'<input type="number" value="'+x.g+'" inputmode="decimal" style="width:68px;text-align:right" oninput="newRcpSetG('+i+',this.value)">'
      +'<button class="add" style="padding:1px 7px" onclick="newRcpDel('+i+')">删</button></div>';
    if(ok){
      h+='<div style="font-size:11.5px;color:var(--ink3);margin-top:5px">'
        +Math.round(f.kcal*x.g/100)+' kcal · 蛋白 '+(f.p*x.g/100).toFixed(1)+'g · 碳水 '+(f.c*x.g/100).toFixed(1)
        +'g · 脂肪 '+(f.f*x.g/100).toFixed(1)+'g · 钠 '+Math.round((f.na||0)*x.g/100)+'mg'
        +(f.my?'　｜ 自建食材':'')+'</div>';
    }else{
      h+='<div style="font-size:11.5px;color:var(--r);margin-top:5px;line-height:1.7">库里没有「'+esc(x.raw)+'」<br>';
      const s=aiSug[x.raw];
      if(s&&s.c&&s.c.length){
        h+=s.c.map(function(c){return '<span class="chip" style="margin:3px 4px 0 0" onclick="newRcpSetItem('+i+',\''+esc(c)+'\')">用 '+esc(c)+'</span>'}).join("");
        if(s.why)h+='<div style="color:var(--ink3);margin-top:3px">'+esc(s.why)+'</div>';
      }
      h+='<div style="margin-top:5px"><button class="add" style="padding:2px 8px" onclick="newRcpPick('+i+')">自己选</button>'
        +' <button class="add" style="padding:2px 8px" onclick="openNewFood(\''+esc(x.raw).replace(/'/g,"")+'\')">新建这个食材</button></div>';
      h+='</div>';
    }
    h+='</div>';
  });
  h+='<div style="height:8px"></div><button class="btn ghost" onclick="newRcpPick(-1)">＋ 加食材</button>';
  h+='<div class="sec"><b>做法</b><span>一行一步，可以留空</span></div>';
  h+='<textarea id="nr_steps" placeholder="鸡胸切块，加生抽腌 5 分钟&#10;水开下锅煮 3 分钟&#10;捞出拌蒜末" oninput="newRcp.steps=this.value">'+esc(newRcp.steps)+'</textarea>';
  h+='<div class="preview" id="nr_total" style="margin-top:10px">'+newRcpTotalText()+'</div>';
  h+='<div style="height:12px"></div><button class="btn" onclick="saveNewRcp()">'
    +(editing?"保存修改":"保存到我的菜谱")+'</button>';
  h+='<div style="height:8px"></div><button class="btn ghost" onclick="closeSheet()">取消</button>';
  if(editing)h+='<div style="height:8px"></div><button class="btn ghost" style="color:var(--r)" onclick="delDishFromEdit()">删除这条</button>';
  openSheet(h);
}
function newRcpSetItem(i,name){
  const f=BY[name];
  if(!f)return;
  newRcp.items[i].n=f.n;
  newRcp.items[i].how="手动";
  renderNewRcp();
}
function grabForm(){
  const e1=document.getElementById("nr_name");
  if(e1)newRcp.n=e1.value;
  const e2=document.getElementById("nr_steps");
  if(e2)newRcp.steps=e2.value;
}
function newRcpSetG(i,v){
  const n=parseFloat(v);
  if(isNaN(n)||n<0)return;
  newRcp.items[i].g=Math.round(n);
  const el=document.getElementById("nr_total");
  if(el)el.innerHTML=newRcpTotalText();
}
function newRcpDel(i){
  grabForm();
  newRcp.items.splice(i,1);
  renderNewRcp();
}
let newRcpPickIdx=-1;
function newRcpPick(i){
  grabForm();
  newRcpPickIdx=(typeof i==="number")?i:-1;
  const t=newRcpPickIdx>=0?"换成库里的哪个":"加食材";
  openSheet('<h3>'+t+'</h3><div class="sm">选一样'+(newRcpPickIdx>=0?"替换「"+esc(newRcp.items[newRcpPickIdx].raw)+"」":"")+'</div>'
    +'<input type="search" id="npq" placeholder="搜食材，比如 鸡胸 / 豆腐" oninput="newRcpPickSearch(this.value)">'
    +'<div id="nplist" style="max-height:46vh;overflow-y:auto;margin-top:8px">'+newRcpPickList("")+'</div>'
    +'<div style="height:8px"></div><button class="btn ghost" onclick="renderNewRcp()">返回</button>');
}
function newRcpPickList(kw){
  const list=F.filter(function(f){return nameHit(f,kw)}).slice(0,40);
  if(!list.length)return '<div class="empty">没找到，换个词</div>';
  return list.map(function(f){
    return '<div class="food" onclick="newRcpChoose('+f.id+')">'
      +'<div class="info"><div class="nm">'+f.n+'<span class="badge mut">'+f.ug+'g/'+f.un+'</span></div>'
      +'<div class="mt">'+f.kcal+' kcal · 蛋白 '+f.p+'g</div></div>'
      +'<button class="add">加</button></div>';
  }).join("");
}
function newRcpPickSearch(v){document.getElementById("nplist").innerHTML=newRcpPickList(v)}
function newRcpChoose(id){
  const f=F[id];
  if(newRcpPickIdx>=0&&newRcp.items[newRcpPickIdx]){
    newRcp.items[newRcpPickIdx].n=f.n;
    newRcp.items[newRcpPickIdx].how="手动";
    if(!newRcp.items[newRcpPickIdx].g)newRcp.items[newRcpPickIdx].g=f.ug;
  }else{
    newRcp.items.push({n:f.n,raw:f.n,g:f.ug});
  }
  newRcpPickIdx=-1;
  renderNewRcp();
}
function delDishFromEdit(){
  const i=newRcp.idx;
  if(!(i>-1)||!S.myDish||!S.myDish[i])return;
  if(!confirm("删除「"+S.myDish[i].n+"」？"))return;
  S.myDish.splice(i,1);save();closeSheet();setTab("rcp");
}
function saveNewRcp(){
  const name=String(newRcp.n||"").trim();
  if(!name){alert("先给菜起个名字");return}
  if(!newRcp.items.length){alert("至少加一样食材，否则算不出营养");return}
  const bad=newRcp.items.filter(function(x){return !x.n});
  if(bad.length){
    alert("还有 "+bad.length+" 项没指定食材："+bad.map(function(x){return x.raw}).join("、")
      +"\n\n先给它们指定库里的食材，或者删掉，否则算不出营养。");
    return;
  }
  const steps=String(newRcp.steps||"").split(/\n/).map(function(x){return x.trim()}).filter(Boolean);
  const rec={n:name,i:newRcp.items.map(function(x){return [x.n,x.g]}),note:"自建菜谱",use:0};
  if(steps.length)rec.s=steps;
  S.myDish=S.myDish||[];
  const editing=(typeof newRcp.idx==="number"&&newRcp.idx>-1&&S.myDish[newRcp.idx]);
  if(editing){
    rec.use=S.myDish[newRcp.idx].use||0;
    rec.note=S.myDish[newRcp.idx].note||"自建菜谱";
    const same=S.myDish.filter(function(x,k){return k!==newRcp.idx&&x.n===name});
    if(same.length&&!confirm("已经有一个叫「"+name+"」的了，保存后会用新的替换它。继续吗？"))return;
    S.myDish=S.myDish.filter(function(x,k){return k!==newRcp.idx&&x.n!==name});
    S.myDish.push(rec);
  }else{
    const idx=S.myDish.findIndex(function(x){return x.n===name});
    if(idx>-1){
      if(!confirm("「"+name+"」已经存在，覆盖原来的配方吗？"))return;
      rec.use=S.myDish[idx].use||0;
      S.myDish.splice(idx,1);
    }
    S.myDish.push(rec);
  }
  save();closeSheet();
  q="";setTab("rcp");
  const m=dishMacro(rec,1);
  alert((editing?"已更新「":"已保存「")+name+"」：约 "+m.kcal+" kcal，蛋白 "+m.p+"g。");
}
function openMyRcp(idx){
  const d=(S.myDish||[])[idx];
  if(!d)return;
  const m=dishMacro(d,1);
  let h='<h3>'+esc(d.n)+'</h3><div class="sm">自建菜谱 ｜ '+(d.s?d.s.length+' 步':'没写做法')+'</div>';
  h+='<div class="preview"><div class="l"><b>合计</b><b>'+m.kcal+' kcal</b></div>'
    +'<div class="l"><span>约 '+m.g+'g · 蛋白 '+m.p+'g · 碳水 '+m.c+'g · 脂肪 '+m.f+'g · 钠 '+m.na+'mg</span></div></div>';
  h+='<div class="sec"><b>食材</b><span>'+(d.i||[]).length+' 样</span></div>';
  (d.i||[]).forEach(function(x){
    const f=BY[x[0]];
    h+='<div class="ing"><span>'+esc(x[0])+'</span><span class="q">'+x[1]+'g'+(f?' · '+Math.round(f.kcal*x[1]/100)+' kcal':'')+'</span></div>';
  });
  if(d.s&&d.s.length){
    h+='<div class="sec"><b>做法</b><span>'+d.s.length+' 步</span></div><ol class="steps">'
      +d.s.map(function(x){return '<li>'+esc(x)+'</li>'}).join("")+'</ol>';
  }
  h+='<div style="height:12px"></div><button class="btn" onclick="openMealLog(\'myDish\','+idx+')">记这一餐</button>';
  h+='<div style="height:8px"></div><button class="btn ghost" onclick="openEditDish('+idx+')">编辑配方</button>';
  h+='<div style="height:8px"></div><button class="btn ghost" onclick="closeSheet()">关闭</button>';
  openSheet(h);
}
function renderRcp(){
  let h=`<input type="search" id="rq" placeholder="搜菜名或食材，比如 虾 / 豆腐 / 番茄" value="${q}"><div class="chips">`;
  [["all","全部"],["早","早餐"],["主","主菜"],["汤","汤锅"],["免","免开火"]].forEach(c=>{
    h+=`<span class="chip ${rcpFilter===c[0]?"on":""}" onclick="setRcpFilter('${c[0]}')">${c[1]}</span>`;
  });
  h+=`</div><div class="card" style="padding:12px 14px">
    <button class="btn ghost" onclick="openNewRcp()">＋ 自建菜谱（照着你看到的做法填）</button>
    <div style="height:8px"></div>
    <button class="btn ghost" onclick="openAI()">✦ 用 AI 写一道（需配 key）</button>
  </div>
  <div id="rlist">${rcpListHtml()}</div>`;
  return h;
}
function rcpListHtml(){
  const kw=q.trim();
  let h="";
  if(kw){
    const hf=F.filter(f=>f.n.indexOf(kw)>-1).slice(0,3);
    if(hf.length){
      h+=`<div class="card"><h2>食材营养<span>每 100g · 成分表原值</span></h2>`;
      hf.forEach(f=>{
        h+=`<div class="food"><div class="info"><div class="nm">${f.n}<span class="badge mut">1${f.un}=${f.ug}g</span></div>
        <div class="mt">${f.kcal} kcal · 蛋白 ${f.p}g · 碳水 ${f.c}g · 脂肪 ${f.f}g · ${f.label}</div></div>
        <button class="add" onclick="openAdd(${f.id})">＋</button></div>`;
      });
      h+=`</div>`;
    }
  }
  // 自定义食谱：AI 生成的食谱 + 自建/拆解的菜品，合成一处
  const mine=[];
  (S.myRcp||[]).forEach(function(r,i){
    if(kw&&r.n.indexOf(kw)<0)return;
    mine.push({k:"rcp",i:i,n:r.n,mac:rcpMacro(r),steps:(r.s||[]).length,tag:"AI 生成"});
  });
  (S.myDish||[]).forEach(function(d,i){
    if(kw&&d.n.indexOf(kw)<0)return;
    mine.push({k:"dish",i:i,n:d.n,mac:dishMacro(d,1),steps:(d.s||[]).length,tag:d.note&&d.note.indexOf("AI")>-1?"AI 拆解":"自建"});
  });
  if(mine.length){
    h+=`<div class="card"><h2>自定义食谱<span>${mine.length} 道 · 点开可改</span></h2>`;
    mine.forEach(function(x){
      const m=x.mac;
      h+=`<div class="rec" onclick="${x.k==="rcp"?"openRcp("+((typeof RCP!=="undefined"?RCP.length:0)+x.i)+")":"openMyRcp("+x.i+")"}">
        <div class="t"><b>${esc(x.n)}</b><em><span class="badge ${x.k==="rcp"?"info":"mut"}">${x.tag}</span> ${x.steps?x.steps+" 步":"无步骤"}</em></div>
        <div class="mac">${m.kcal} kcal · 蛋白 ${m.p}g · 碳水 ${m.c}g · 脂肪 ${m.f}g</div>
      </div>`;
    });
    h+=`</div>`;
  }
  const list=RCP.map((r,i)=>({r,i})).filter(x=>(rcpFilter==="all"||x.r.c===rcpFilter)&&rcpMatch(x.r,kw));
  h+=`<div class="card"><h2>${kw?"相关食谱":"全部食谱"}<span>${list.length} 道</span></h2>`;
  if(!list.length)h+=`<div class="empty">没有找到。换个词，或去掉筛选。</div>`;
  list.forEach(x=>{
    const m=rcpMacro(x.r);
    h+=`<div class="rec" onclick="openRcp(${x.i})">
      <div class="t"><b>${x.r.n}</b><em>${x.r.t} 分钟</em></div>
      <div class="mac">${macLine(m)}</div>
      <div class="badges">${x.r.m.slice(0,4).map(n=>`<span class="badge info">${n}</span>`).join("")}</div>
    </div>`;
  });
  h+=`</div>`;
  return h;
}

function renderFood(){
  let h=`<input type="search" id="fq" placeholder="搜食材，比如 鸡蛋 / 虾 / 菠菜" value="${foodQ}">
  <div style="display:flex;gap:8px;justify-content:center;margin:16px 0 10px">
    <span class="chip on" style="display:inline-block;padding:7px 16px" onclick="openAdd()">＋ 添加食材到库存</span>
    <span class="chip" style="display:inline-block;padding:7px 16px" onclick="openNewFood('')">＋ 新建食材</span>
  </div><div id="flist">${foodListHtml()}</div>`;
  return h;
}
function foodListHtml(){
  const kw=foodQ.trim();
  if(!kw)return invHtml();
  const list=F.filter(f=>nameHit(f,kw));
  let h=`<div class="card"><h2>搜索结果<span>${list.length} 条</span></h2>`;
  if(!list.length)h+=`<div class="empty">库里没有这样食材<br>
    <span class="add" style="padding:5px 14px;margin-top:8px;display:inline-block" onclick="openNewFood('${esc(kw).replace(/'/g,"&#39;")}')">＋ 新建「${esc(kw)}」</span></div>`;
  list.forEach(f=>{
    const own=invItem(f.id);
    h+=`<div class="food"><div class="info">
      <div class="nm">${f.n}${own?`<span class="badge mut">库存 ${Math.round(own)}g</span>`:""}</div>
      <div class="mt">${CAT[f.cat]} · ${f.kcal} kcal/100g · 蛋白 ${f.p}g · ${f.label} · ${keepDays(f)<=1?"需当天吃":"常温"+keepDays(f)+"天"}</div>
      <div class="mt" style="color:var(--ink4)">来源：${f.src}</div>
    </div><button class="add" onclick="openAdd(${f.id})">＋1${f.un}</button></div>`;
  });
  h+=`</div>`;
  return h;
}
function invHtml(){
  const sg=S.set;
  let h=`<div class="stat">
    <div class="s"><div class="k">库存种类</div><div class="v">${new Set(S.inv.map(x=>x.id)).size}</div></div>
    <div class="s"><div class="k">临期/过期</div><div class="v">${expireList().length}</div></div>
    <div class="s" onclick="openWaste()" style="cursor:pointer"><div class="k">浪费明细 ›</div><div class="v">${(S.waste||[]).filter(w=>daysAgo(w.d)<=6).length}</div></div>
  </div>
  <div class="card" style="padding:0;overflow:hidden;margin-bottom:12px">`
    +setRow("买菜清单",(S.shop||[]).length?((S.shop||[]).filter(x=>!x.done).length+" 样待买"):"按缺口自动列，买完一键入库","openShop()")+`</div>
  <div class="card"><h2>我的库存<span>按到期排序</span></h2>`;
  if(!S.inv.length)h+=`<div class="empty">还没有食材<br>点上面「＋ 添加食材到库存」</div>`;
  else{
    [...S.inv].sort((a,b)=>remDays(a)-remDays(b)).forEach(it=>{
      const f=foodOf(it),r=remDays(it);
      if(!f)return;
      const bd=r<0?["已过期","badge warn"]:r<=0?["今天要用","badge warn"]:r<=3?[r+"天","badge info"]:[r+"天","badge mut"];
      h+=`<div class="food" onclick="openBatch('${it.d}',${it.id})">
        <div class="info"><div class="nm">${f.n}<span class="${bd[1]}">${bd[0]}</span></div>
        <div class="mt">净 ${Math.round(it.g)}g${f.e<100?"（毛 "+Math.round(it.g/(f.e/100))+"g）":""} · ${Math.round(f.kcal*it.g/100)} kcal · 蛋白 ${(f.p*it.g/100).toFixed(1)}g · 买于 ${it.d.slice(5)}</div></div></div>`;
    });
  }
  h+=`</div>`;
  return h;
}

function weekStats(days,last7){
  const logged=last7.filter(function(d){return days[d]});
  const n=logged.length;
  const sum=logged.reduce(function(a,d){return a+days[d].kcal},0);
  const avg=n?Math.round(sum/n):0;
  const hit=last7.filter(function(d){return days[d]&&days[d].p>=S.set.protein*0.85}).length;
  const w7=(S.waste||[]).filter(function(w){return daysAgo(w.d)<=6});
  const wg=w7.reduce(function(a,w){return a+(w.g||0)},0);
  const wk=w7.reduce(function(a,w){const f=foodOf(w);return a+(f?f.kcal*w.g/100:0)},0);
  return {n:n,avg:avg,hit:hit,w7:w7,wg:wg,wk:wk,exp:expireList()};
}
function weekBrief(days,last7){
  const st=weekStats(days,last7), sg=S.set;
  const adv=[];
  if(st.n<4){
    adv.push("这周只记了 "+st.n+" 天，还看不出趋势。先把记录稳定下来，哪怕每天只记一顿。");
  }else{
    if(st.avg>sg.kcal+200) adv.push("日均 "+st.avg+" kcal，比目标高 "+(st.avg-sg.kcal)+"，先查主食份量和食堂的油。");
    else if(st.avg<sg.kcal-300) adv.push("日均 "+st.avg+" kcal，比目标低 "+(sg.kcal-st.avg)+"，掉太快容易掉肌肉，主食加回来一点。");
    if(st.hit<4) adv.push("蛋白达标 "+st.hit+"/"+st.n+" 天，不到一半。每天固定一份蛋白比临时补更管用。");
  }
  if(st.w7.length>=2) adv.push("这周扔了 "+st.w7.length+" 次（"+Math.round(st.wg)+"g，折合 "+Math.round(st.wk)+" kcal）。看看是哪几样总放过期，直接从采购清单里删掉。");
  if(st.exp.length) adv.push("现在有 "+st.exp.length+" 样快过期，今明两天优先用掉。");
  if(!adv.length) adv.push("这周记录稳定、蛋白达标、没有浪费，保持就行。");
  return '<div class="card"><h2>本周简报<span>记录了 '+st.n+'/7 天</span></h2>'
    +'<div style="font-size:13px;line-height:1.85;color:var(--ink2)">'
    +'<div>日均 <b style="color:var(--ink)">'+st.avg+'</b> kcal（目标 '+sg.kcal+'）　·　蛋白达标 <b style="color:var(--ink)">'+st.hit+'</b> 天</div>'
    +'<div>浪费 '+st.w7.length+' 次 · '+Math.round(st.wg)+'g　·　库存临期 '+st.exp.length+' 样</div>'
    +'<div style="margin-top:9px;padding:10px 12px;background:var(--gl);border-radius:9px;color:var(--ok-ink)">'
    +adv.map(function(x){return '<div>· '+x+'</div>'}).join("")+'</div>'
    +'</div>'
    +'<div style="height:10px"></div><button class="btn ghost" onclick="openWeekReport()">看明细</button>'
    +'</div>';
}
function openWeekReport(){
  const days={};S.logs.forEach(function(l){days[l.d]=days[l.d]||{kcal:0,p:0};days[l.d].kcal+=l.kcal||0;days[l.d].p+=l.p||0});
  const last7=Array.from({length:7},function(_,i){const d=new Date();d.setDate(d.getDate()-i);return dstr(d)}).reverse();
  const st=weekStats(days,last7);
  let h='<h3>本周明细</h3><div class="sm">'+last7[0]+' 至 '+last7[6]+'</div>';
  h+='<div class="sec"><b>逐日</b></div>';
  last7.forEach(function(d){
    const x=days[d];
    h+='<div class="logitem"><span>'+d.slice(5)+'</span><span class="r">'
      +(x?Math.round(x.kcal)+' kcal · 蛋白 '+Math.round(x.p)+'g'+(x.p>=S.set.protein*0.85?' ✓':'')
         :'<span style="color:var(--ink4)">无记录</span>')+'</span></div>';
  });
  h+='<div class="sec"><b>浪费</b> · '+st.w7.length+' 次</div>';
  if(!st.w7.length)h+='<div class="empty">这周没有浪费记录</div>';
  else h+=st.w7.slice().sort(function(a,b){return b.d.localeCompare(a.d)}).map(function(w){
    const f=foodOf(w);if(!f)return "";
    return '<div class="logitem"><span>'+esc(f.n)+'</span><span class="r">'+Math.round(w.g)+'g · '+Math.round(f.kcal*w.g/100)+' kcal<br><span style="color:var(--ink4)">'+w.d.slice(5)+'</span></span></div>';
  }).join("");
  h+='<div class="sec"><b>库存临期</b> · '+st.exp.length+' 样</div>';
  if(!st.exp.length)h+='<div class="empty">没有临期食材</div>';
  else h+=st.exp.map(function(x){
    const f=BY[foodName(x)];
    return '<div class="logitem"><span>'+esc(f.n)+'</span><span class="r">'+(x.rem<=0?'今天要用':'还剩 '+x.rem+' 天')+'</span></div>';
  }).join("");
  h+='<div style="height:12px"></div><button class="btn ghost" onclick="closeSheet()">关闭</button>';
  openSheet(h);
}
function renderLog(){
  const e=eatenToday();
  const days={};S.logs.forEach(l=>{days[l.d]=days[l.d]||{kcal:0,p:0};days[l.d].kcal+=l.kcal||0;days[l.d].p+=l.p||0});
  const last7=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-i);return dstr(d)}).reverse();
  const hit=last7.filter(d=>days[d]&&days[d].p>=S.set.protein*0.85).length;
  const avg=last7.filter(d=>days[d]).reduce((a,d)=>a+days[d].kcal,0)/Math.max(1,last7.filter(d=>days[d]).length);
  let h=`<div class="stat">
    <div class="s"><div class="k">7天蛋白达标</div><div class="v">${hit} 天</div></div>
    <div class="s"><div class="k">日均热量</div><div class="v">${Math.round(avg)||0}</div></div>
    <div class="s"><div class="k">今日</div><div class="v">${Math.round(e.kcal)}</div></div>
  </div>`
  +weekBrief(days,last7)+
  `<div class="card"><button class="btn" onclick="openLogSheet()">＋ 记一笔（食堂 / 加餐）</button></div>
  <div class="card"><h2 onclick="openTrend()" style="cursor:pointer">最近 7 天<span>点开看趋势图表 ›</span></h2><div class="bars">`;
  last7.forEach(d=>{
    const k=days[d]?days[d].kcal:0;
    h+=`<div class="bar-row"><span class="lb">${d.slice(5)}</span><div class="tr"><div class="fl" style="width:${k?Math.min(100,k/S.set.kcal*100):2}%;background:${k?"#3B6D11":"var(--soft)"}"></div></div><span class="vl">${k?Math.round(k):"—"}</span></div>`;
  });
  h+=`</div></div>`;
  const tl=S.logs.filter(l=>l.d===today()).reverse();
  h+=`<div class="card"><h2 onclick="openDay(today())" style="cursor:pointer">记录<span>今天 ${tl.length} 条 · 点开按餐看 ›</span></h2>`;
  if(!tl.length)h+=`<div class="empty">还没有记录</div>`;
  ["早","午","晚","加",""].forEach(mk=>{
    const items=tl.filter(l=>(MEALS.indexOf(l.m)>=0?l.m:"")===mk);
    if(!items.length)return;
    const kk=items.reduce((a,l)=>a+(l.kcal||0),0);
    h+=`<div class="sec" style="margin-top:10px"><b>${MEAL_LABEL[mk]}</b><span>${items.length} 条 · ${Math.round(kk)} kcal</span></div>`;
    items.forEach(l=>{
      const li=S.logs.indexOf(l);
      h+=`<div class="food" onclick="openLogDetail(${li})"><div class="info">
        <div class="nm">${esc(l.name)}</div>
        <div class="mt">${Math.round(l.kcal)} kcal · 蛋白 ${Math.round(l.p)}g · 碳水 ${Math.round(l.c||0)}g · 脂肪 ${Math.round(l.f||0)}g</div>
      </div><span style="color:var(--ink4);font-size:16px">›</span></div>`;
    });
  });
  h+=`</div>`;
  h+='<div class="card" style="padding:0;overflow:hidden;margin-top:4px">'
    +setRow("设置","目标 · 天气 · AI · 自定义食谱 · 数据","setTab('set')")
    +'</div>';
  return h;
}
/* ============ 设置：目录页 ============ */
function setRow(title,sub,fn){
  return '<div class="setrow" onclick="'+fn+'"><div class="t"><b>'+title+'</b><em>'+sub+'</em></div><span class="ar">›</span></div>';
}
function renderSettings(){
  const s=S.set;
  const nR=(S.myRcp||[]).length, nD=(S.myDish||[]).length;
  let h="";
  h+='<div class="card" style="padding:0;overflow:hidden">';
  h+=setRow("身体与目标",s.sex+" · "+s.weight+"kg · 目标 "+s.kcal+" kcal / 蛋白 "+s.protein+"g","openSetBody()");
  h+=setRow("本地天气",(s.city?s.city+" · ":"")+"室温偏移 +"+s.offset+"℃","openSetWeather()");
  h+=setRow("AI 写菜谱",((S.ai&&S.ai.key)?"已配置 · "+(S.ai.model||"deepseek-flash"):"未配置 · 点这里填 key"),"openSetAI()");
  h+=setRow("我的自定义食谱",nR+" 道 AI 食谱 · "+nD+" 道自建/拆解","openSetRcp()");
  h+=setRow("数据","备份 · 恢复 · 清空（只存本机）","openSetData()");
  const _u=S.upd||{};
  let updSub;
  if(_u.err)updSub="上次检查失败 · 点这里重查";
  else if(_u.newer)updSub="发现新版 v"+_u.latest+" · 点这里去下载";
  else if(_u.latest)updSub="已是最新 v"+_u.latest+" · "+updTime(_u.at);
  else updSub="当前 v"+APP_VER+" · 点这里手动查";
  h+=setRow("检查更新",updSub,"openSetUpdate()");
  h+='</div>';
  h+='<div class="card"><h2>关于<span>v'+APP_VER+'</span></h2><div style="font-size:12px;color:var(--ink3);line-height:1.75">'
    +'营养数据：《中国食物成分表 标准版（第6版）》'+F.filter(function(f){return !f.my}).length+' 条 + 包装标签 '
    +F.filter(function(f){return String(f.src).indexOf("包装")>-1}).length+' 条 + 常见值若干，全部按每 100g 可食部，标注生重/熟重/净重。'
    +'<br>保存期为食品常识估算，不是实验数据。</div></div>';
  return h;
}

/* ============ 设置：各分组（用底部弹层编辑） ============ */
function openSetBody(){
  const s=S.set;
  openSheet('<h3>身体与目标</h3><div class="sm">'+(s.locked?"手动锁定中":"随体重自动计算")+'</div>'
    +'<div class="row3"><div><label class="fl">性别</label><select onchange="setP(\'sex\',this.value)">'
    +'<option value="女"'+(s.sex==="女"?" selected":"")+'>女</option><option value="男"'+(s.sex==="男"?" selected":"")+'>男</option></select></div>'
    +'<div><label class="fl">体重 kg</label><input type="number" value="'+s.weight+'" inputmode="decimal" onchange="setP(\'weight\',this.value)"></div></div>'
    +'<div class="row3"><div><label class="fl">身高 cm</label><input type="number" value="'+s.height+'" inputmode="decimal" onchange="setP(\'height\',this.value)"></div>'
    +'<div><label class="fl">年龄</label><input type="number" value="'+s.age+'" inputmode="numeric" onchange="setP(\'age\',this.value)"></div></div>'
    +'<label class="fl">活动量</label><select onchange="setP(\'act\',this.value)">'
    +'<option value="1.2"'+(s.act==1.2?" selected":"")+'>久坐（几乎不运动）</option>'
    +'<option value="1.375"'+(s.act==1.375?" selected":"")+'>轻度（每周 1–3 次）</option>'
    +'<option value="1.55"'+(s.act==1.55?" selected":"")+'>中度（每周 3–5 次）</option></select>'
    +'<div class="preview"><div class="l"><b>当前目标</b><b>'+s.kcal+' kcal</b></div>'
    +'<div class="l"><span>蛋白 '+s.protein+'g ｜ 脂肪 '+s.fat+'g ｜ 碳水 '+s.carb+'g ｜ 钠 2000mg</span></div></div>'
    +'<div class="btns"><button class="btn ghost" onclick="toggleLock()">'+(s.locked?"恢复自动":"手动锁定")+'</button>'
    +'<button class="btn ghost" onclick="openGoal()">直接改目标</button></div>'
    +'<div style="height:8px"></div><button class="btn ghost" onclick="renderSettingsTab()">返回设置</button>'
    +'<div style="margin-top:10px;font-size:11.5px;color:var(--ink4);line-height:1.7">Mifflin-St Jeor 算基础代谢 × 活动系数 − 400 kcal 缺口；蛋白 1.6g/kg、脂肪 0.8g/kg，碳水由余量反推。</div>');
}
function openSetWeather(){
  const s=S.set;
  openSheet('<h3>本地天气</h3><div class="sm">只用来修正食材保存期</div>'
    +'<label class="fl">城市</label><div style="display:flex;gap:8px">'
    +'<input type="search" id="city" value="'+esc(s.city||"")+'" placeholder="如 北京 / 武汉" style="flex:1">'
    +'<button class="add" onclick="saveCity()">保存</button></div>'
    +'<label class="fl">室温偏移（寝室通常比室外高 2–5℃，有暖气可设 8–10）</label>'
    +'<input type="number" id="w_off" value="'+s.offset+'" inputmode="decimal" onchange="setP(\'offset\',this.value)">'
    +'<div class="preview"><div class="l"><b>当前</b><b>'+((S.w&&S.w.t!=null)?(S.w.t+"℃"):"未取到")+'</b></div>'
    +'<div class="l"><span>室温估算 '+((S.w&&S.w.t!=null)?Math.round(S.w.t+(+s.offset||0))+"℃":"按季节")+'</span></div></div>'
    +'<button class="btn ghost" onclick="loadWeather(true)">刷新气温</button>'
    +'<div style="height:8px"></div><button class="btn ghost" onclick="renderSettingsTab()">返回设置</button>');
}
function openSetAI(){
  const a=S.ai||{};
  openSheet('<h3>AI 写菜谱</h3><div class="sm">可选 · 数值一律由本地库重算</div>'
    +'<label class="fl">接口地址</label><input type="search" id="ai_base" value="'+esc(a.base||"https://api.deepseek.com/v1")+'">'
    +'<label class="fl">API Key</label><div style="display:flex;gap:8px">'
    +'<input type="password" id="ai_key" value="'+esc(a.key||"")+'" placeholder="sk-..." style="flex:1">'
    +'<button class="add" onclick="toggleKey()">显示</button></div>'
    +'<label class="fl">模型名</label><div class="chips" style="padding:2px 0 8px">'
    +'<span class="chip" onclick="setModel(\'deepseek-flash\')">deepseek-flash</span>'
    +'<span class="chip" onclick="setModel(\'deepseek-v4-pro\')">deepseek-v4-pro</span>'
    +'<span class="chip" onclick="testAI()">测试连接取列表</span></div>'
    +'<input type="search" id="ai_model" value="'+esc(a.model||"deepseek-flash")+'" placeholder="deepseek-flash">'
    +'<div style="height:10px"></div><button class="btn" onclick="saveAI()">保存配置</button>'
    +'<div id="ai_test" style="margin-top:10px"></div>'
    +'<div style="height:8px"></div><button class="btn ghost" onclick="renderSettingsTab()">返回设置</button>'
    +'<div style="margin-top:10px;font-size:11.5px;color:var(--ink4);line-height:1.7">Key 明文存在本机，建议单独申请限额 key。</div>');
}
function openSetRcp(){
  const R=S.myRcp||[], D=S.myDish||[];
  let h='<h3>我的自定义食谱</h3><div class="sm">AI 生成的食谱 + 自建/拆解的菜品</div>';
  h+='<div class="sec"><b>AI 生成的食谱</b><span>'+R.length+' 道</span></div>';
  if(!R.length)h+='<div class="empty">没有<br>去食谱页用 AI 写一道</div>';
  else h+=R.map(function(r,i){
    const m=rcpMacro(r);
    return '<div class="logitem"><span>'+esc(r.n)+'<br><span style="font-size:11px;color:var(--ink4)">'+m.kcal+' kcal · P'+m.p+'g</span></span>'
      +'<span class="r" style="display:flex;gap:6px;align-items:center">'
      +'<button class="add" style="padding:1px 8px" onclick="openEditRcp('+i+')">改</button>'
      +'<button class="add" style="padding:1px 8px" onclick="delMyRcp('+i+')">删</button></span></div>';
  }).join("");
  h+='<div class="sec"><b>自建与拆解的菜品</b><span>'+D.length+' 道</span></div>';
  if(!D.length)h+='<div class="empty">没有<br>食谱页「自建菜谱」或记一笔里 AI 拆解后保存</div>';
  else h+=D.map(function(d,i){
    const m=dishMacro(d,1);
    return '<div class="logitem"><span>'+esc(d.n)+'<br><span style="font-size:11px;color:var(--ink4)">'+m.kcal+' kcal · P'+m.p+'g · '+(d.s?d.s.length+" 步":"无步骤")+'</span></span>'
      +'<span class="r" style="display:flex;gap:6px;align-items:center">'
      +'<button class="add" style="padding:1px 8px" onclick="closeSheet();openEditDish('+i+')">改</button>'
      +'<button class="add" style="padding:1px 8px" onclick="delMyDish('+i+');openSetRcp()">删</button></span></div>';
  }).join("");
  if((R.length+D.length)>1)h+='<div style="height:10px"></div><button class="btn ghost" onclick="doDedupe();openSetRcp()">清理重复</button>';
  h+='<div style="height:8px"></div><button class="btn ghost" onclick="renderSettingsTab()">返回设置</button>';
  openSheet(h);
}
function openSetData(){
  openSheet('<h3>数据</h3><div class="sm">都在这台手机里，不上传</div>'
    +'<button class="btn" onclick="exportData()">导出备份到手机</button>'
    +'<div style="height:8px"></div><button class="btn ghost" onclick="importData()">从备份恢复</button>'
    +'<div style="height:8px"></div><button class="btn ghost" style="color:var(--r)" onclick="clearAll()">清空数据</button>'
    +'<div class="preview" style="margin-top:14px"><div class="l"><span>库存</span><b>'+S.inv.length+' 条</b></div>'
    +'<div class="l"><span>饮食记录</span><b>'+S.logs.length+' 条</b></div>'
    +'<div class="l"><span>自定义食谱</span><b>'+((S.myRcp||[]).length)+' 道</b></div>'
    +'<div class="l"><span>自建菜品</span><b>'+((S.myDish||[]).length)+' 道</b></div>'
    +'<div class="l"><span>自建食材</span><b>'+((S.myFood||[]).length)+' 项</b></div></div>'
    +'<div style="height:8px"></div><button class="btn ghost" onclick="renderSettingsTab()">返回设置</button>');
}
function renderSettingsTab(){ setTab("set"); }


function render(){
  $("sub").innerHTML=subHtml();
  const isSet=(tab==="set");
  $("h1t").textContent=isSet?"设置":"寝室餐食助手";
  $("backbtn").style.display=isSet?"block":"none";
  $("sub").style.display=isSet?"none":"flex";
  if(tab==="today")view.innerHTML=renderToday();
  else if(tab==="rcp"){view.innerHTML=renderRcp();
    const rq=$("rq");if(rq)rq.addEventListener("input",e=>{q=e.target.value;$("rlist").innerHTML=rcpListHtml()});}
  else if(tab==="food"){view.innerHTML=renderFood();
    const fq=$("fq");if(fq)fq.addEventListener("input",e=>{foodQ=e.target.value;$("flist").innerHTML=foodListHtml()});}
  else if(tab==="set")view.innerHTML=renderSettings();
  else view.innerHTML=renderLog();
  document.querySelectorAll("nav button").forEach(b=>b.classList.toggle("on",b.dataset.tab===(tab==="set"?"log":tab)));
  const _v=document.getElementById("view");
  if(_v){_v.classList.remove("anim");void _v.offsetWidth;_v.classList.add("anim")}
  a11yPatch();
}
function setTab(t){
  try{if(typeof tab!=="undefined"&&tab&&memoTab)memoTab.set(tab,window.scrollY)}catch(e){}
  tab=t;q="";foodQ="";render();
  const y=(memoTab?memoTab.get(t):0);
  requestAnimationFrame(function(){window.scrollTo(0,y)});
}
document.querySelectorAll("nav button").forEach(b=>b.addEventListener("click",()=>setTab(b.dataset.tab)));
function setRcpFilter(c){rcpFilter=c;render()}
function setP(k,v){
  const n=parseFloat(v);
  if(k==="sex"||k==="city"){S.set[k]=v}else{if(!isNaN(n))S.set[k]=n}
  calcTargets();save();render();
}
function toggleLock(){S.set.locked=!S.set.locked;if(!S.set.locked)calcTargets();save();render()}
function openGoal(){
  const k=prompt("每日热量目标 kcal",S.set.kcal);
  if(k===null)return;
  const p=prompt("每日蛋白目标 g",S.set.protein);
  if(p===null)return;
  S.set.kcal=Math.round(parseFloat(k)||S.set.kcal);
  S.set.protein=Math.round(parseFloat(p)||S.set.protein);
  S.set.locked=true;save();render();
}
async function saveCity(){
  const c=($("city").value||"").trim();
  S.set.city=c;
  if(!c){S.set.lat=null;S.set.lon=null;save();render();return}
  try{
    const g=await geocode(c);
    S.set.lat=g.latitude;S.set.lon=g.longitude;S.set.city=g.name||c;
    save();render();loadWeather(true);
  }catch(e){alert("没找到这个城市，换个写法试试")}
}

let sheetTimer=null,sheetPrevFocus=null;
/* ===== 滚动锁：弹层/整页打开时，背后的页面不跟着动 ===== */
let scrollLock=0;
function lockScroll(d){
  scrollLock=Math.max(0,scrollLock+d);
  document.body.style.overflow=scrollLock?"hidden":"";
}

/* ===== 弹层：每一层压栈，手势/返回键只退一层 ===== */
let sheetStack=[],sheetCur="",sheetRedraw=false,sheetHoldLock=false,sheetPushNext=false;

function openSheet(html,opt){
  opt=opt||{};
  const sh=$("sheet"),box=$("sheetBox");
  if(sheetTimer){clearTimeout(sheetTimer);sheetTimer=null}
  const wasOn=sh.classList.contains("on");
  sh.classList.remove("closing");
  /* 已经开着弹层时再开一个＝进一层；renderXxx 这类重绘会先置 sheetRedraw，不压栈 */
  if(wasOn&&!opt.replace&&(opt.push||sheetPushNext||!sheetRedraw)&&sheetCur)sheetStack.push(sheetCur);
  sheetRedraw=false;sheetPushNext=false;
  box.setAttribute("tabindex","-1");
  if(!wasOn){
    sheetPrevFocus=document.activeElement;
    sheetStack=[];
    box.style.animation="none";
    if(!sheetHoldLock){sheetHoldLock=true;lockScroll(1)}
  }
  box.innerHTML='<button class="x" onclick="closeSheet()" aria-label="关闭">×</button>'
    +'<div class="sheetIn">'+html+'</div>';
  sheetCur=html;
  box.scrollTop=0;
  if(!wasOn){
    void box.offsetWidth;
    box.style.animation="sheetUp .42s cubic-bezier(.22,1,.36,1) both";
  }else{
    /* 换层：面板本身不动，只让内容按方向轻移 20px（进＝从右，退＝从左） */
    box.style.animation="none";
    const inner=box.querySelector(".sheetIn");
    if(inner){
      inner.classList.remove("inR","inL");
      void inner.offsetWidth;
      inner.classList.add(opt.back?"inL":"inR");
    }
  }
  sh.classList.add("on");
  a11yPatch(box);
  if(!wasOn)setTimeout(function(){try{box.focus({preventScroll:true})}catch(e){}},30);
}
/* 退一层；已经在第一层就整层关闭 */
function sheetBack(){
  const sh=$("sheet");
  if(!sh||!sh.classList.contains("on"))return false;
  if(!sheetStack.length){closeSheet();return true}
  const prev=sheetStack.pop();
  openSheet(prev,{replace:1,back:1});
  return true;
}
function closeSheet(instant){
  const sh=$("sheet");
  if(!sh)return;
  if(sheetTimer){clearTimeout(sheetTimer);sheetTimer=null}
  const box=$("sheetBox");
  sheetStack=[];sheetCur="";
  if(box){box.style.animation="";box.style.transform="";box.style.transition=""}
  const unlock=function(){
    if(sheetHoldLock){sheetHoldLock=false;lockScroll(-1)}
    if(sheetPrevFocus&&sheetPrevFocus.isConnected){try{sheetPrevFocus.focus({preventScroll:true})}catch(e){}}
    sheetPrevFocus=null;
  };
  if(instant||!sh.classList.contains("on")){
    sh.classList.remove("on","closing");
    unlock();
    return;
  }
  sh.classList.add("closing");
  sheetTimer=setTimeout(function(){
    sh.classList.remove("on","closing");
    sheetTimer=null;
    unlock();
  },310);
}

/* 打开动画放完就撤掉 fill:both，否则它会一直压住行内 transform，下拉拖动时面板不跟手 */
$("sheetBox").addEventListener("animationend",function(e){
  if(e.target!==this)return;
  /* 一定落到 "none"：若清成空串，CSS 里的 .sheet.on .box 会重新接管并重播上滑 */
  if(e.animationName==="sheetUp"||e.animationName==="sheetStep")this.style.animation="none";
});

let addId=-1,addUnit="u",addGross=false;
function openAdd(id){
  if(id==null){
    openSheet(`<h3>添加食材</h3><div class="sm">搜名字或别名，点一下就能加</div>
    <input type="search" id="aq" placeholder="鸡蛋 / 虾 / 豆腐 / 西兰花" oninput="addSearch(this.value)">
    <div id="alist" style="max-height:52vh;overflow-y:auto;margin-top:8px">${addListHtml("")}</div>`);
    return;
  }
  addId=id;addUnit="u";addGross=false;sheetPushNext=1;renderAddSheet();
}
function renderAddSheet(){
  sheetRedraw=1;
  const f=F[addId],er=f.e/100,gross1=f.ug/er;
  let h=`<h3>${f.n}</h3><div class="sm">1${f.un} ≈ 净重 ${f.ug}g${f.e<100?"（毛重约 "+Math.round(gross1)+"g，可食部 "+f.e+"%）":""}<br>
  ${f.kcal} kcal/100g ｜ 蛋白 ${f.p}g ｜ 碳水 ${f.c}g ｜ 脂肪 ${f.f}g<br>
  钠 ${Math.round(f.na||0)}mg ｜ 钙 ${Math.round(f.ca||0)}mg ｜ 铁 ${(f.fe||0).toFixed(1)}mg ｜ 维C ${(f.vc||0).toFixed(1)}mg<br>
  ${f.note?f.note+"<br>":""}<span style="color:var(--ink4)">来源：${f.src}</span></div>`;
  h+=`<div class="chips">
    <span class="chip ${addUnit==='u'?'on':''}" onclick="setAU('u')">按${f.un}</span>
    <span class="chip ${addUnit==='g'?'on':''}" onclick="setAU('g')">按克数</span>
  </div>`;
  if(addUnit==='u'){
    h+=`<label class="fl">数量（${f.un}）</label>
    <input type="number" id="addq" value="1" inputmode="decimal" oninput="calcAdd()">
    <div class="chips" style="margin-top:10px">
      <span class="chip" onclick="setQ(0.5)">半${f.un}</span>
      <span class="chip" onclick="setQ(1)">1${f.un}</span>
      <span class="chip" onclick="setQ(2)">2${f.un}</span>
      <span class="chip" onclick="setQ(3)">3${f.un}</span>
    </div>`;
  }else{
    h+=`<div class="chips">
      <span class="chip ${!addGross?'on':''}" onclick="setAG(false)">净重</span>
      ${f.e<100?"<span class=\'chip "+(addGross?"on":"")+"\' onclick=\'setAG(true)\'>毛重（带壳/带骨）</span>":""}
    </div>
    <label class="fl">克数（${addGross?"带壳/带骨":"可食部净重"}）</label>
    <input type="number" id="addq" value="${addGross?Math.round(gross1):f.ug}" inputmode="decimal" oninput="calcAdd()">`;
  }
  h+=`<div class="preview" id="apv"></div>
  <button class="btn" onclick="doAdd()">加进库存</button>
  <div style="height:8px"></div><button class="btn ghost" onclick="sheetBack()">换个食材</button>`;
  openSheet(h);calcAdd();
}
function setAU(u){addUnit=u;renderAddSheet()}
function setAG(g){addGross=g;renderAddSheet()}
function setQ(n){const e=document.getElementById("addq");if(e){e.value=n;calcAdd()}}
function addNet(){
  const f=F[addId];const el=document.getElementById("addq");
  const v=el?parseFloat(el.value):0;
  if(!v||v<=0)return 0;
  if(addUnit==="u")return v*f.ug;
  return addGross?v*(f.e/100):v;
}
function calcAdd(){
  const f=F[addId],net=addNet(),pv=document.getElementById("apv");
  if(!pv)return;
  if(!net){pv.innerHTML='<span style="color:var(--ink3)">填个数量或克数</span>';return}
  pv.innerHTML=`<div class="l"><b>计入库存（净重）</b><b>${Math.round(net)}g</b></div>
  <div class="l"><span style="color:var(--ink3)">${f.e<100?"对应毛重 "+Math.round(net/(f.e/100))+"g（可食部 "+f.e+"%）":"全部可食"}</span></div>
  <div class="l"><span>热量 ${Math.round(f.kcal*net/100)} kcal ｜ 蛋白 ${(f.p*net/100).toFixed(1)}g</span></div>`;
}
function doAdd(){
  const net=addNet();
  if(!net||net<=0)return;
  S.inv.push({id:addId,n:(F[addId]||{}).n,g:Math.round(net*10)/10,d:today()});
  save();closeSheet();render();
}
function addListHtml(kw){
  const list=F.filter(f=>nameHit(f,kw)).slice(0,40);
  return list.map(f=>`<div class="food" onclick="openAdd(${f.id})">
    <div class="info"><div class="nm">${f.n}<span class="badge mut">${f.ug}g/${f.un}</span></div>
    <div class="mt">${f.kcal} kcal · 蛋白 ${f.p}g · ${CAT[f.cat]}</div></div>
    <button class="add">＋</button></div>`).join("");
}
function addSearch(v){document.getElementById("alist").innerHTML=addListHtml(v)}
function setAdd(g){const e=document.getElementById("addg");if(e)e.value=g}
function openBatch(d,id){
  const b=S.inv.find(x=>x.d===d&&x.id===id);
  if(!b)return;
  const f=foodOf(b),r=remDays(b);
  if(!f)return;
  const st=r<0?`已过期 ${-r} 天`:r<=0?"今天最后一天":`还剩 ${r} 天`;
  openSheet(`<h3>${f.n}</h3><div class="sm">${Math.round(b.g)}g ｜ 买于 ${b.d.slice(5)} ｜ ${st}</div>
  <label class="fl">改成实际剩余克数</label>
  <input type="number" id="addg" value="${Math.round(b.g)}" inputmode="decimal">
  <div style="height:14px"></div><button class="btn" onclick="saveBatch('${d}',${id})">保存</button>
  <div style="height:8px"></div><button class="btn ghost" onclick="dropBatch('${d}',${id})">扔掉这一份（记入浪费）</button>
  <div style="height:8px"></div><button class="btn ghost" style="color:var(--r)" onclick="delBatch('${d}',${id})">删除这条（录错了，不计浪费）</button>`);
}
function delBatch(d,id){
  if(!confirm("删除这条库存记录？\n\n用于录错了想重填，不计入浪费。"))return;
  S.inv=S.inv.filter(function(x){return !(x.d===d&&x.id===id)});
  save();closeSheet();render();
}
function saveBatch(d,id){
  const n=parseFloat($("addg").value);
  if(!n||n<=0)return;
  const b=S.inv.find(x=>x.d===d&&x.id===id);if(b)b.g=n;
  save();closeSheet();render();
}
function dropBatch(d,id){
  S.waste=S.waste||[];
  const b=S.inv.find(x=>x.d===d&&x.id===id);
  if(b)S.waste.push({id:b.id,n:foodName(b),g:b.g,d:today()});
  S.inv=S.inv.filter(x=>!(x.d===d&&x.id===id));
  save();closeSheet();render();
}

let curRcp=-1;

/* ===================== 记这一餐（统一入口） =====================
   自建菜谱与内置食谱走同一个页面：可选「吃库存 / 吃食堂」，
   可增减每个食材的克数、去掉没放的、临时加别的食材。
   所有调整只作用于这一次记录，不改食谱本身。 */
let mlCtx=null;

function mlBuild(kind,idx,src){
  let title="",items=[];
  if(kind==="rcp"){
    const r=ALL()[idx];if(!r)return null;
    title=r.n;
    (r.m||[]).forEach(function(n){const f=BY[n];if(f)items.push({n:n,base:f.ug,g:f.ug,on:true,opt:false})});
    (r.o||[]).forEach(function(n){const f=BY[n];if(f)items.push({n:n,base:f.ug,g:f.ug,on:false,opt:true})});
  }else{
    const d=(S.myDish||[])[idx];if(!d)return null;
    title=d.n;
    (d.i||[]).forEach(function(x){
      const f=BY[x[0]];
      items.push({n:x[0],base:x[1],g:x[1],on:true,opt:false});
    });
  }
  return {kind:kind,idx:idx,title:title,items:items,mult:1,src:src||"stock"};
}
function openMealLog(kind,idx,src){
  mlCtx=mlBuild(kind,idx,src);
  if(!mlCtx){alert("找不到这道菜");return}
  mlApplySrc();sheetPushNext=1;renderMealLog();
}
function mlApplySrc(){
  const c=mlCtx;
  c.items.forEach(function(it){
    const f=BY[it.n],own=f?invQty(f.n):0;
    it.g=(c.src==="stock"&&own>0)?Math.min(it.base,Math.max(1,Math.round(own))):it.base;
    if(it.opt)it.on=false;
  });
}
function mlMacros(){
  const c=mlCtx;let k=0,p=0,f=0,cb=0,na=0,veg=0,n=0,fib=0,ca=0,fe=0,vc=0;
  c.items.forEach(function(it){
    if(!it.on||!(it.g>0))return;
    const fd=BY[it.n];if(!fd)return;      /* 注意：别用 f，会遮住上面累加脂肪的 f */
    const r=it.g/100;
    k+=fd.kcal*r;p+=fd.p*r;f+=fd.f*r;cb+=fd.c*r;
    na+=(fd.na||0)*r;fib+=(fd.fib||0)*r;ca+=(fd.ca||0)*r;fe+=(fd.fe||0)*r;vc+=(fd.vc||0)*r;
    if(fd.cat==="veg")veg+=it.g;n++;
  });
  return {kcal:k,p:p,f:f,c:cb,na:na,veg:veg,n:n,
    fib:Math.round(fib*10)/10,ca:Math.round(ca),fe:Math.round(fe*10)/10,vc:Math.round(vc*10)/10};
}
function mlPreview(){
  if(!mlCtx)return;
  const m=mlMacros(),pv=$("mlpv");if(!pv)return;
  pv.innerHTML='<div class="l"><b>这一餐</b><b>'+Math.round(m.kcal)+' kcal</b></div>'
    +'<div class="l"><span>蛋白 '+m.p.toFixed(1)+'g ｜ 碳水 '+m.c.toFixed(1)+'g ｜ 脂肪 '+m.f.toFixed(1)+'g</span><span></span></div>'
    +'<div class="l"><span style="color:var(--ink3)">钠 '+Math.round(m.na)+'mg'+(m.na>800?'　⚠ 偏高':'')+'</span></div>';
  pv.dataset.k=m.kcal;pv.dataset.p=m.p;pv.dataset.f=m.f;pv.dataset.c=m.c;pv.dataset.na=m.na;pv.dataset.veg=m.veg;
}
function renderMealLog(){
  sheetRedraw=1;
  const c=mlCtx;if(!c)return;
  let h='<h3>'+esc(c.title)+'</h3><div class="sm">'+(c.kind==="rcp"?"食谱":"自建菜谱")
    +' ｜ 这里的改动只算这一餐，不改食谱本身</div>';
  h+='<div class="chips" style="margin:4px 0 2px">'
    +[["stock","吃库存（扣库存）"],["canteen","吃食堂（不扣库存）"]].map(function(x){
      return '<span class="chip '+(c.src===x[0]?"on":"")+'" onclick="setMealSrc(\''+x[0]+'\')">'+x[1]+'</span>';
    }).join("")+'</div>';
  h+='<div class="chips" style="margin:2px 0 6px">'
    +[0.5,1,1.5,2].map(function(v){
      return '<span class="chip '+(c.mult===v?"on":"")+'" onclick="setMealMult('+v+')">'+v+' 份</span>';
    }).join("")
    +'<span class="chip" onclick="openMealAdd()">＋ 加食材</span></div>';
  h+='<div class="sec"><b>实际放了什么</b><span>点名字＝这份不放</span></div>';
  c.items.forEach(function(it,i){
    const f=BY[it.n];
    const kcal=f?Math.round(f.kcal*it.g/100):0;
    const prot=f?(f.p*it.g/100).toFixed(1):"0";
    const own=f?invQty(f.n):0;
    const lack=(c.src==="stock"&&it.on&&f&&own<=0)?'<span class="badge warn" style="margin-left:4px">缺</span>':"";
    const opt=it.opt?'<span class="badge mut" style="margin-left:4px">可选</span>':"";
    h+='<div class="opt'+(it.on?" on":"")+'" style="'+(it.on?"":"opacity:.5")+'">'
      +'<span class="on1" onclick="toggleMealItem('+i+')">'+esc(it.n)+opt+lack
      +'<br><span style="font-size:11.5px;color:var(--ink3)">'+(f?kcal+' kcal · 蛋白 '+prot+'g':'库里没有这个食材')+'</span></span>'
      +'<input type="number" value="'+Math.round(it.g)+'" inputmode="decimal" '+(it.on?"":"disabled")
      +' onchange="setMealG('+i+',this.value)"></div>';
  });
  h+='<div class="preview" id="mlpv"></div>';
  h+='<div class="sm" style="margin-bottom:0">记到哪一餐</div>'+mealChips();
  h+='<button class="btn" onclick="saveMealLog()">记下这一餐</button>';
  h+='<div style="height:8px"></div><button class="btn ghost" onclick="backToRcp()">返回食谱详情</button>';
  openSheet(h);
  mlPreview();
}
function setMealSrc(k){
  mlCtx.src=k;mlApplySrc();renderMealLog();
}
function setMealMult(v){
  mlCtx.mult=v;
  mlCtx.items.forEach(function(it){it.g=Math.max(1,Math.round(it.base*v))});
  renderMealLog();
}
function toggleMealItem(i){
  const it=mlCtx.items[i];if(!it)return;
  it.on=!it.on;renderMealLog();
}
function setMealG(i,v){
  const it=mlCtx.items[i],g=parseFloat(v);
  if(!it||!(g>0))return;
  it.g=g;mlPreview();
}
function saveMealLog(){
  if(!mlCtx)return;
  const c=mlCtx,m=mlMacros();
  if(!m.n){alert("至少留一样食材");return}
  if(c.src==="stock"){
    c.items.forEach(function(it){
      if(!it.on||!(it.g>0))return;
      const f=BY[it.n];if(!f)return;
      let need=it.g;
      S.inv.filter(function(x){return foodName(x)===f.n}).sort(function(a,b){return a.d.localeCompare(b.d)}).forEach(function(b){
        if(need<=0)return;
        const use=Math.min(need,b.g);b.g-=use;need-=use;
      });
    });
    S.inv=S.inv.filter(function(x){return x.g>0.5});
  }
  const nm=(c.src==="canteen"?"食堂 · ":"")+c.title+(c.mult!==1?" ×"+c.mult:"");
  S.logs.push({d:logDate(),m:logMeal,name:nm,kcal:Math.round(m.kcal),
    p:+m.p.toFixed(1),f:+m.f.toFixed(1),c:+m.c.toFixed(1),na:Math.round(m.na),veg:Math.round(m.veg),
    fib:m.fib,ca:m.ca,fe:m.fe,vc:m.vc});
  logDone("today",nm+" · "+Math.round(m.kcal)+" kcal");
}
function backToRcp(){
  const c=mlCtx;if(!c)return;
  if(sheetStack.length){sheetBack();return}          /* 有上一层就退回去，不重新铺一遍 */
  if(c.kind==="rcp")openRcp(c.idx);else openMyRcp(c.idx);
}
function openMealAdd(){
  openSheet('<h3>加一份食材</h3><div class="sm">只加到这一餐，不动食谱</div>'
    +'<input type="search" id="maq" placeholder="搜食材" oninput="mealAddSearch(this.value)">'
    +'<div id="malist" style="max-height:46vh;overflow-y:auto;margin-top:8px">'+mealAddList("")+'</div>'
    +'<div style="height:8px"></div><button class="btn ghost" onclick="sheetBack()">返回这一餐</button>');
}
function mealAddList(kw){
  const list=F.filter(function(f){return nameHit(f,kw)}).slice(0,40);
  if(!list.length)return '<div class="empty">没搜到</div>';
  return list.map(function(f){
    return '<div class="food" onclick="mealAddPick('+f.id+')"><div class="info">'
      +'<div class="nm">'+f.n+'<span class="badge mut">'+f.ug+'g/'+f.un+'</span></div>'
      +'<div class="mt">'+f.kcal+' kcal · 蛋白 '+f.p+'g</div></div>'
      +'<button class="add">＋</button></div>';
  }).join("");
}
function mealAddSearch(v){const el=$("malist");if(el)el.innerHTML=mealAddList(v)}
function mealAddPick(id){
  const f=F[id];if(!f||!mlCtx)return;
  const g=Math.max(1,Math.round(f.ug*mlCtx.mult));
  mlCtx.items.push({n:f.n,base:f.ug,g:g,on:true,opt:false,added:true});
  if(sheetStack.length)sheetStack.pop();      /* 加完回到这一餐 */
  renderMealLog();
}

/* ===================== 整页覆盖层 ===================== */
let pagePrevFocus=null,pageHoldLock=false;
var MEMO_TTL=5*60e3;                      /* 5 分钟内回到原位置，超过就从头开始 */
var pageMemo={};
function memoSet(k,y){if(k)pageMemo[k]={y:y,at:Date.now()}}
function memoGet(k){const m=k&&pageMemo[k];return (m&&Date.now()-m.at<MEMO_TTL)?m.y:0}
function pageKey(){
  if(typeof pageMode==="undefined"||!pageMode)return "page";
  return "page:"+pageMode;
}
/* 标签页的滚动记忆 */
var memoTab={
  set:function(k,y){pageMemo["tab:"+k]={y:y,at:Date.now()}},
  get:function(k){return memoGet("tab:"+k)}
};
let pageTimer=null,pageStack=[];
function openPage(html,opt){
  opt=opt||{};
  const p=$("page"),i=$("pageIn");if(!p||!i)return;
  const wasOpen=p.classList.contains("on")||p.classList.contains("closing");  /* 正在收起也算"开着"，避免重复加锁 */
  const newMode=opt.mode||pageMode||"";
  const sameMode=wasOpen&&newMode===(pageMode||"");
  if(pageTimer){clearTimeout(pageTimer);pageTimer=null}
  if(!wasOpen){
    pagePrevFocus=document.activeElement;
    pageStack=[];                                   /* 全新打开：祖先进程清空 */
  }else if(!sameMode&&!opt.replace){
    /* 同一个覆盖层里换了一种页面（趋势→当天）：把当前这层压栈，返回时原路退回 */
    pageStack.push({html:i.innerHTML,mode:pageMode||"",scroll:p.scrollTop});
  }
  pageMode=newMode;
  /* 已经打开时重绘（点柱子、切范围）保持当前位置；首次打开才取记忆 */
  const keep=opt.top?0:(wasOpen?p.scrollTop:memoGet(opt.key||pageKey()));
  p.classList.remove("closing","backstep");
  i.style.transition="";i.style.transform="";        /* 清掉拖拽留下的内联位移 */
  i.classList.remove("slideL","slideR","pushIn","slideout");
  i.innerHTML=html;
  p.classList.add("on");
  if(!pageHoldLock){pageHoldLock=true;lockScroll(1)}
  p.scrollTop=keep;
  a11yPatch(i);
  void i.offsetWidth;
  if(opt.slide){
    const cls=opt.slide>0?"slideL":"slideR";
    i.classList.add(cls);
    setTimeout(function(){i.classList.remove(cls)},260);   /* 动画带 fill:both，不摘掉会压住后续拖拽 */
  }else if(wasOpen&&!sameMode){
    i.classList.add("pushIn");
    setTimeout(function(){i.classList.remove("pushIn")},280);
  }
}
function closePage(){
  const p=$("page"),i=$("pageIn");if(!p||!i||!p.classList.contains("on"))return;
  memoSet(pageKey(),p.scrollTop);
  if(pageTimer){clearTimeout(pageTimer);pageTimer=null}

  /* 还有上一层：当前内容向右滑出，再把上一层接回来（原路逐级退出） */
  if(pageStack.length){
    const prev=pageStack.pop();
    i.classList.remove("slideL","slideR","slideout");
    void i.offsetWidth;
    i.classList.add("slideout");
    pageTimer=setTimeout(function(){
      pageTimer=null;
      i.classList.remove("slideout");
      pageMode=prev.mode||"";
      i.innerHTML=prev.html;
      p.scrollTop=prev.scroll;
      p.classList.add("backstep");
      setTimeout(function(){p.classList.remove("backstep")},200);
      a11yPatch(i);
    },190);
    return;
  }

  /* 最后一层：整页滑出后真正关闭 */
  const finish=function(){
    if(pageTimer){clearTimeout(pageTimer);pageTimer=null}
    p.removeEventListener("animationend",onEnd);
    p.classList.remove("on","closing","backstep");    /* 一次移除，避免 pageIn 重播 */
    if(pageHoldLock){pageHoldLock=false;lockScroll(-1)}
    if(pagePrevFocus&&pagePrevFocus.isConnected){try{pagePrevFocus.focus({preventScroll:true})}catch(e){}}
    pagePrevFocus=null;
    pageMode="";
    logDay="";                                        /* 离开记录页就别再留着补记目标 */
  };
  const onEnd=function(e){if(e.target===p&&e.animationName==="pageOut")finish()};
  p.addEventListener("animationend",onEnd);
  p.classList.add("closing");
  pageTimer=setTimeout(finish,300);                   /* 动画事件缺失时兜底 */
}
function dayAdd(ds,n){const d=new Date(ds+"T00:00:00");d.setDate(d.getDate()+n);return dstr(d)}
function dayLabel(ds){
  const w="日一二三四五六"[new Date(ds+"T00:00:00").getDay()];
  return ds.slice(5).replace("-","月")+"日 周"+w;
}


/* ===================== 趋势（最近 N 天 / 自定义） ===================== */
let trKey="7", trCust={from:"",to:""}, trSel=-1, trData=[], trWin=["",""], pageMode="";
function trendWindow(){
  const to=today();
  if(trKey==="custom"){
    const f=trCust.from||dayAdd(to,-6), t=trCust.to||to;
    return (new Date(f+"T00:00:00")<=new Date(t+"T00:00:00"))?[f,t]:[t,f];
  }
  const n=+trKey||7;
  return [dayAdd(to,-(n-1)),to];
}
function trendBuckets(from,to){
  const list=[];
  for(let d=from;d<=to;d=dayAdd(d,1))list.push(d);
  const days=list.length||1;
  const step=days>35?7:1;
  const out=[];
  for(let i=0;i<list.length;i+=step){
    const chunk=list.slice(i,i+step);
    const b={from:chunk[0],to:chunk[chunk.length-1],kcal:0,p:0,c:0,f:0,n:0,days:chunk.length};
    chunk.forEach(function(d){
      const s=daySum(d);
      if(s.t.n){b.kcal+=s.t.kcal;b.p+=s.t.p;b.c+=s.t.c;b.f+=s.t.f;b.n++;}
    });
    out.push(b);
  }
  return out;
}
function openTrend(){pageMode="trend";trSel=-1;renderTrend();}
function setTrend(k){trKey=k;trSel=-1;renderTrend();}
function applyCust(){
  const f=$("trFrom")?$("trFrom").value:"",t=$("trTo")?$("trTo").value:"";
  if(!f||!t){alert("两头日期都要选");return}
  if(new Date(f+"T00:00:00")>new Date(t+"T00:00:00")){alert("开始日期不能晚于结束日期");return}
  trCust={from:f,to:t};trKey="custom";trSel=-1;renderTrend();
}
function pickTrend(i){trSel=(trSel===i?-1:i);renderTrend();}
function bucketLabel(b){
  return b.from===b.to?b.from.slice(5):b.from.slice(5)+"~"+b.to.slice(5);
}
function renderTrend(){
  const win=trendWindow();trWin=win;
  trData=trendBuckets(win[0],win[1]);
  const nDays=trData.reduce(function(a,b){return a+b.days},0);
  const logged=trData.reduce(function(a,b){return a+b.n},0);
  const avg=function(k){return logged?trData.reduce(function(a,b){return a+b[k]},0)/logged:0};
  const sg=S.set;
  let h='<div class="phead"><button onclick="closePage()">关闭</button>'
    +'<div class="ttl">趋势</div><button onclick="openDay(\''+win[1]+'\')">看当天</button></div>';
  h+='<div class="pbody" style="padding-top:12px">';
  h+='<div class="chips" style="margin:0 0 4px">'
    +[["7","近 7 天"],["30","近 30 天"],["180","近半年"],["custom","自定义"]].map(function(x){
      return '<span class="chip '+(trKey===x[0]?"on":"")+'" onclick="setTrend(\''+x[0]+'\')">'+x[1]+'</span>';
    }).join("")+'</div>';
  if(trKey==="custom"){
    h+='<div style="display:flex;gap:8px;align-items:center;margin:6px 0 8px">'
      +'<input type="date" id="trFrom" value="'+(trCust.from||win[0])+'" style="flex:1;padding:8px 10px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink);font-family:inherit">'
      +'<input type="date" id="trTo" value="'+(trCust.to||win[1])+'" style="flex:1;padding:8px 10px;border:1px solid var(--line);border-radius:9px;background:var(--card);color:var(--ink);font-family:inherit">'
      +'<button class="add" style="padding:8px 12px" onclick="applyCust()">应用</button></div>';
  }
  h+='<div class="sm" style="margin-bottom:8px">'+win[0]+' 至 '+win[1]+' ｜ 共 '+nDays+' 天，有记录 '+logged+' 天</div>';
  // 均值
  h+='<div class="card"><h2>每日均值<span>只算有记录的天</span></h2>'
    +'<div class="stat" style="margin-bottom:0">'
    +'<div class="s"><div class="k">热量</div><div class="v">'+Math.round(avg("kcal"))+'</div></div>'
    +'<div class="s"><div class="k">碳水</div><div class="v">'+Math.round(avg("c"))+'</div></div>'
    +'<div class="s"><div class="k">蛋白</div><div class="v">'+Math.round(avg("p"))+'</div></div>'
    +'</div>'
    +'<div style="font-size:11.5px;color:var(--ink3);margin-top:8px">目标：'
    +sg.kcal+' kcal ｜ 蛋白 '+sg.protein+'g ｜ 碳水 '+sg.carb+'g ｜ 脂肪 '+sg.fat+'g</div></div>';
  // 热量图
  const maxK=Math.max.apply(null,trData.map(function(b){return b.kcal}).concat([1]));
  h+='<div class="card"><h2>热量<span>kcal</span></h2>';
  h+='<div class="chart">'+trData.map(function(b,i){
    const hp=b.n?Math.max(3,b.kcal/maxK*100):0;
    return '<div class="col'+(trSel===i?" on":"")+'" onclick="pickTrend('+i+')">'
      +(b.n?'<div class="b" style="height:'+hp+'%"></div>':'<div class="z"></div>')+'</div>';
  }).join("")+'</div>';
  h+='<div class="tipbar" id="trTipK">'+(trSel>=0?tipK(trSel):"点一根柱子看数值")+'</div></div>';
  // 营养素图
  const maxN=Math.max.apply(null,trData.map(function(b){return Math.max(b.c,b.p,b.f)}).concat([1]));
  h+='<div class="card"><h2>营养素<span>克</span></h2>';
  h+='<div class="chart">'+trData.map(function(b,i){
    const hh=function(v){return b.n?Math.max(2,v/maxN*100):0};
    return '<div class="col'+(trSel===i?" on":"")+'" onclick="pickTrend('+i+')">'
      +(b.n?'<div class="b c" style="height:'+hh(b.c)+'%"></div>'
           +'<div class="b p" style="height:'+hh(b.p)+'%"></div>'
           +'<div class="b f" style="height:'+hh(b.f)+'%"></div>'
           :'<div class="z"></div>')+'</div>';
  }).join("")+'</div>';
  h+='<div class="tipbar" id="trTipN">'+(trSel>=0?tipN(trSel):"点一根柱子看数值")+'</div>'
    +'<div class="legend"><span><i style="background:#7FA9D6"></i>碳水</span>'
    +'<span><i style="background:#8DBB6B"></i>蛋白</span>'
    +'<span><i style="background:#D9B36A"></i>脂肪</span></div></div>';
  h+='<div class="empty" style="padding:10px 0 0">'+(trData.length>35?"数据点多，按周汇总":"")+'</div>';
  h+='</div>';
  openPage(h,{mode:"trend"});
}
function tipK(i){
  const b=trData[i];if(!b)return "";
  return bucketLabel(b)+' · <b>'+Math.round(b.kcal)+' kcal</b>'+(b.n?'':'（无记录）');
}
function tipN(i){
  const b=trData[i];if(!b)return "";
  return bucketLabel(b)+' · 碳水 <b>'+Math.round(b.c)+'g</b> ｜ 蛋白 <b>'+Math.round(b.p)+'g</b> ｜ 脂肪 <b>'+Math.round(b.f)+'g</b>';
}

/* ===================== 日历 ===================== */
let calY=0,calM=0,calMode="view";
function openCal(){
  calMode="view";
  const d=new Date(dayCur+"T00:00:00");
  calY=d.getFullYear();calM=d.getMonth();renderCal();
}
function calMove(n){
  calM+=n;if(calM<0){calM=11;calY--}if(calM>11){calM=0;calY++}
  renderCal();
}
function renderCal(){
  sheetRedraw=1;
  const isLog=calMode==="log",sel=isLog?logDate():dayCur,td=today();
  const first=new Date(calY,calM,1),start=first.getDay(),days=new Date(calY,calM+1,0).getDate();
  const has={};S.logs.forEach(function(l){has[l.d]=1});
  let h='<h3>'+(isLog?"补记到哪一天":"选择日期")+'</h3>'
    +'<div class="sm">'+(isLog?"今天和以前的日期都能选":"有记录的日期会标绿")+'</div>';
  h+='<div class="pnav" style="padding-top:4px"><button onclick="calMove(-1)">‹</button>'
    +'<span>'+calY+' 年 '+(calM+1)+' 月</span><button onclick="calMove(1)">›</button></div>';
  h+='<div class="cal">'+["日","一","二","三","四","五","六"].map(function(x){return '<div class="hd">'+x+'</div>'}).join("");
  for(let i=0;i<start;i++)h+='<div></div>';
  for(let d=1;d<=days;d++){
    const ds=dstr(new Date(calY,calM,d));
    const off=isLog&&ds>td;
    h+='<div class="d'+(has[ds]?" has":"")+(ds===td?" today":"")+(ds===sel?" sel":"")+(off?" off":"")
      +(off?'':' onclick="'+(isLog?"calPickLog":"calPick")+'(\''+ds+'\')"')+'>'+d+'</div>';
  }
  h+='</div>';
  h+='<div style="height:12px"></div><button class="btn ghost" onclick="'+(isLog?"renderLogSheet()":"closeSheet()")+'">取消</button>';
  openSheet(h);
}
function calPick(ds){
  dayCur=ds;closeSheet();renderDayView();
}
function calPickLog(ds){
  logDay=(ds===today())?"":ds;
  renderLogSheet();
}

/* 覆盖层手势：
   日视图左右拖＝三页轨道跟手滑动（邻居从两侧进来），松手够远就翻页；
   屏幕边缘起手＝交给系统返回 / 退出这一页；滑到底再上滑＝日历 */
(function(){
  const pg=document.getElementById("page");
  if(!pg)return;
  let sx=0,sy=0,t0=0,axis="",active=false,edge=false;

  pg.addEventListener("touchstart",function(e){
    if(e.touches.length!==1)return;
    sx=e.touches[0].clientX;sy=e.touches[0].clientY;t0=Date.now();
    axis="";active=false;edge=(sx<26||sx>window.innerWidth-26);
  },{passive:true});

  pg.addEventListener("touchmove",function(e){
    if(e.touches.length!==1||pageMode!=="day")return;
    const dx=e.touches[0].clientX-sx,dy=e.touches[0].clientY-sy;
    if(!axis){
      if(Math.abs(dx)>10&&Math.abs(dx)>Math.abs(dy)*1.25)axis="x";
      else if(Math.abs(dy)>10)axis="y";
    }
    if(axis!=="x"||edge)return;
    const track=$("dayTrack");
    if(!track)return;
    if(!active){active=true;track.style.transition="none";fitPager("max")}
    const lim=window.innerWidth*0.45;
    let tx=dx;
    if(Math.abs(tx)>lim)tx=(tx<0?-1:1)*(lim+(Math.abs(tx)-lim)*0.35);   /* 越界橡皮筋 */
    track.style.transform="translateX(calc(-33.3333% + "+tx+"px))";     /* 三页一起跟手 */
    if(e.cancelable)e.preventDefault();
  },{passive:false});

  function settle(){
    const track=$("dayTrack");if(!track)return;
    track.style.transition="transform .26s cubic-bezier(.22,1,.36,1)";
    track.style.transform="translateX(-33.3333%)";
    setTimeout(fitPager,270);            /* 回弹后再收回到当前页高度 */
  }
  function pageTo(dir){
    const track=$("dayTrack");
    if(!track){dayCur=dayAdd(dayCur,dir);renderDayView();return}
    track.style.transition="transform .24s cubic-bezier(.22,1,.36,1)";
    track.style.transform="translateX("+(dir>0?-66.6667:0)+"%)";
    setTimeout(function(){
      dayCur=dayAdd(dayCur,dir);
      renderDayView();                       /* 重建三页，落回中间 */
    },250);
  }

  pg.addEventListener("touchend",function(e){
    const t=(e.changedTouches&&e.changedTouches[0])||{clientX:sx,clientY:sy};
    const dx=t.clientX-sx,dy=t.clientY-sy,dt=Math.max(1,Date.now()-t0),vx=dx/dt;
    if(active){
      active=false;axis="";
      const w=window.innerWidth;
      /* 翻页判定：拖过屏宽 22%，或"够快且超过 40px"的甩动；否则回弹 */
      const far=Math.abs(dx)>w*0.22;
      const flick=Math.abs(vx)>0.55&&Math.abs(dx)>40&&dt<=400;
      if(far||flick)pageTo(dx<0?1:-1);
      else settle();
      return;
    }
    /* 没进入拖拽：边缘退出、快速轻扫换天、底部上滑开日历 */
    if(edge&&dx>60&&Math.abs(dx)>Math.abs(dy)*1.4){closePage();return}
    if(pageMode!=="day")return;
    if(!edge&&Math.abs(dx)>55&&Math.abs(dx)>Math.abs(dy)*1.5){shiftDay(dx<0?1:-1);return}
    const atBottom=pg.scrollTop+pg.clientHeight>=pg.scrollHeight-30;
    if(dy<-70&&Math.abs(dy)>Math.abs(dx)*1.5&&atBottom)openCal();
  },{passive:true});

  pg.addEventListener("touchcancel",function(){
    if(active){active=false;axis="";settle()}
  },{passive:true});
})();

/* ===================== 日视图（记录某一天） ===================== */
let dayCur="",daySlide=0;
function openDay(ds){
  dayCur=ds||dayCur||today();
  renderDayView();
}
let dayBusy=false;
function shiftDay(n){
  const track=$("dayTrack");
  if(!track||dayBusy){dayCur=dayAdd(dayCur,n);renderDayView();return}
  dayBusy=true;
  track.style.transition="transform .24s cubic-bezier(.22,1,.36,1)";
  track.style.transform="translateX("+(n>0?-66.6667:0)+"%)";
  setTimeout(function(){
    dayBusy=false;
    dayCur=dayAdd(dayCur,n);
    renderDayView();
  },250);
}
function daySum(ds){
  const ls=S.logs.filter(function(l){return l.d===ds});
  const t=ls.reduce(function(a,l){
    return {kcal:a.kcal+(l.kcal||0),p:a.p+(l.p||0),f:a.f+(l.f||0),c:a.c+(l.c||0),na:a.na+(l.na||0),veg:a.veg+(l.veg||0)};
  },{kcal:0,p:0,f:0,c:0,na:0,veg:0});
  t.n=ls.length;return {ls:ls,t:t};
}
function dayBodyHtml(ds){
  const {ls,t}=daySum(ds),sg=S.set;
  let h='<div class="pbody">';
  h+='<div class="card"><h2>当日合计<span>'+(ds===today()?"今天":"")+'</span></h2>'
    +'<div class="stat" style="margin-bottom:0">'
    +'<div class="s"><div class="k">热量</div><div class="v">'+Math.round(t.kcal)+'</div></div>'
    +'<div class="s"><div class="k">蛋白</div><div class="v">'+Math.round(t.p)+'</div></div>'
    +'<div class="s"><div class="k">碳水</div><div class="v">'+Math.round(t.c)+'</div></div>'
    +'</div>'
    +'<div class="bars" style="margin-top:10px">'
    +bar("热量",t.kcal,sg.kcal,"#3B6D11")+bar("蛋白",t.p,sg.protein,"#1D9E75")
    +bar("碳水",t.c,sg.carb,"#378ADD")+bar("脂肪",t.f,sg.fat,"#BA7517")
    +'</div></div>';
  if(!ls.length){
    h+='<div class="empty" style="padding-bottom:2px">这天没有记录<br>左右滑动切换日期</div>';
    h+='<div style="margin:0 0 10px"><button class="btn ghost" onclick="openLogFor(\''+ds+'\')">＋ 补记这一天</button></div>';
  }else{
    ["早","午","晚","加",""].forEach(function(mk){
      const items=ls.filter(function(l){return (MEALS.indexOf(l.m)>=0?l.m:"")===mk});
      if(!items.length)return;
      const kk=items.reduce(function(a,l){return a+(l.kcal||0)},0);
      const pp=items.reduce(function(a,l){return a+(l.p||0)},0);
      const share=t.kcal>0?Math.round(kk/t.kcal*100):0;
      h+='<div class="card" style="padding:12px 14px"><h2>'+MEAL_LABEL[mk]
        +'<span>'+items.length+' 条 · '+Math.round(kk)+' kcal · '+share+'%</span></h2>';
      items.forEach(function(l){
        const li=S.logs.indexOf(l);
        h+='<div class="food" onclick="openLogDetail('+li+')">'
          +'<div class="info"><div class="nm">'+esc(l.name)+'</div>'
          +'<div class="mt">'+Math.round(l.kcal)+' kcal · 蛋白 '+Math.round(l.p)+'g · 碳水 '+Math.round(l.c||0)+'g · 脂肪 '+Math.round(l.f||0)+'g'
          +(l.na?' · 钠 '+Math.round(l.na)+'mg':'')+'</div></div>'
          +'<span style="color:var(--ink4);font-size:16px">›</span></div>';
      });
      h+='<div style="font-size:11.5px;color:var(--ink3);margin-top:6px">蛋白小结 '+Math.round(pp)+'g</div></div>';
    });
  }
  h+='<div class="empty" style="padding:14px 0 6px">左右滑动换一天 · 滑到底部再上滑打开日历</div>';
  h+='</div>';
  return h;
}
function renderDayView(){
  const ds=dayCur;
  let h='<div class="phead"><button onclick="closePage()">关闭</button>'
    +'<div class="ttl">记录 · '+ds.slice(5)+'</div>'
    +'<button class="padd" onclick="openLogFor(\''+ds+'\')" aria-label="给这天记一笔">＋</button>'
    +'<button onclick="openCal()">日历</button></div>';
  h+='<div class="pnav"><button onclick="shiftDay(-1)">‹</button>'
    +'<span>'+dayLabel(ds)+'</span><button onclick="shiftDay(1)">›</button></div>';
  h+='<div class="pager"><div class="track" id="dayTrack">';
  [dayAdd(ds,-1),ds,dayAdd(ds,1)].forEach(function(d){
    h+='<div class="pane">'+dayBodyHtml(d)+'</div>';
  });
  h+='</div></div>';
  openPage(h,{mode:"day"});
  fitPager();
}
/* 轨道高度：静止时对齐「当天」这一页；拖动时按三页里最高的一页，
   避免"短页翻到长页"时长页被裁掉半截 */
function fitPager(mode){
  const track=$("dayTrack");
  if(!track)return;
  const pager=track.parentNode,ps=track.children;
  let h=0;
  if(mode==="max"){
    for(let i=0;i<ps.length;i++)h=Math.max(h,ps[i].offsetHeight);
  }else if(ps[1]){
    h=ps[1].offsetHeight;
  }
  pager.style.height=h+"px";
  if(mode!=="max"){
    track.style.transition="none";
    track.style.transform="translateX(-33.3333%)";
    void track.offsetWidth;
  }
}

/* ===== 单条记录详情 ===== */
function openLogDetail(i){
  const l=S.logs[i];if(!l)return;
  const kc=l.kcal||0,pc=(l.c||0)*4,pp=(l.p||0)*4,pf=(l.f||0)*9;
  const tot=pc+pp+pf||1;
  const pct=function(x){return Math.round(x/tot*100)};
  const rows=[["碳水",pct(pc)],["蛋白质",pct(pp)],["脂肪",pct(pf)]];
  let h='<h3>'+esc(l.name)+'</h3><div class="sm">'+l.d+' ｜ '+MEAL_LABEL[l.m||""]+'</div>';
  h+='<div class="stat" style="grid-template-columns:repeat(4,1fr)">'
    +'<div class="s"><div class="k">热量</div><div class="v">'+Math.round(kc)+'</div></div>'
    +'<div class="s"><div class="k">碳水</div><div class="v">'+Math.round(l.c||0)+'</div></div>'
    +'<div class="s"><div class="k">蛋白</div><div class="v">'+Math.round(l.p||0)+'</div></div>'
    +'<div class="s"><div class="k">脂肪</div><div class="v">'+Math.round(l.f||0)+'</div></div>'
    +'</div>';
  h+='<div class="sec"><b>热量来源</b><span>按 4/4/9 折算</span></div>';
  rows.forEach(function(r){
    h+='<div class="bar-row" style="margin-bottom:7px"><span class="lb">'+r[0]+'</span>'
      +'<div class="tr"><div class="fl" style="width:'+r[1]+'%;background:var(--g)"></div></div>'
      +'<span class="vl">'+r[1]+'%</span></div>';
  });
  h+='<div class="sec"><b>其他营养成分</b></div>';
  const others=[["膳食纤维",l.fib,"g"],["钠",l.na,"mg"],["钙",l.ca,"mg"],["铁",l.fe,"mg"],["维C",l.vc,"mg"],["蔬菜",l.veg,"g"]];
  others.forEach(function(o){
    const v=o[1];
    h+='<div class="logitem"><span>'+o[0]+'</span><span class="r">'
      +(v==null?'<span style="color:var(--ink4)">—</span>':(Math.round(v*10)/10)+' '+o[2])+'</span></div>';
  });
  h+='<div style="font-size:11.5px;color:var(--ink3);margin-top:8px;line-height:1.6">'
    +'旧记录记于 v3.8 之前，当时只存了热量和三大营养素，微量营养素显示为 —</div>';
  h+='<div style="height:12px"></div><button class="btn" onclick="openEditLog('+i+')">改这条记录</button>';
  h+='<div style="height:8px"></div><button class="btn ghost" onclick="delLogFromDetail('+i+')">删除这条</button>';
  openSheet(h);
}
function delLogFromDetail(i){
  if(!confirm("删掉这条记录？"))return;
  S.logs.splice(i,1);save();closeSheet();renderDayView();
}

function openRcp(i){
  const _r=ALL()[i];
  if(_r&&_r.myDishIdx!=null){openMyRcp(_r.myDishIdx);return}
  curRcp=i;
  const r=ALL()[i],m=rcpMacro(r);
  let h=`<h3>${r.n}</h3><div class="sm">${r.d||""} ｜ 约 ${r.t} 分钟 ｜ ${r.c==="免"?"不用开火":"一锅到底"}</div>`;
  h+=`<div class="preview"><div class="l"><b>按默认份量</b><b>${m.kcal} kcal</b></div>
    <div class="l"><span>蛋白 ${m.p}g ｜ 碳水 ${m.c}g ｜ 脂肪 ${m.f}g</span><span></span></div>
    <div class="l"><span>钠 ${m.na}mg</span><span></span></div></div>`;
  h+=`<div class="sec"><b>食材</b></div>`;
  r.m.forEach(n=>{
    const f=BY[n];if(!f)return;
    const alt=supplyOf(n);
    const badge=alt?(alt===n?"":" <span class='badge info'>用"+alt+"</span>"):" <span class='badge warn'>缺</span>";
    h+=`<div class="ing"><span>${n}${badge}</span><span class="q">${f.ug}g（1${f.un}）</span></div>`;
  });
  (r.o||[]).forEach(n=>{
    if(!BY[n])return;
    h+=`<div class="ing" style="opacity:.7"><span>${n}（可选）</span><span class="q">${BY[n].ug}g</span></div>`;
  });
  h+=`<div class="sec"><b>做法</b><span>${r.s.length} 步</span></div><ol class="steps">${r.s.map(x=>`<li>${x}</li>`).join("")}</ol>`;
  if(r.chk)h+=`<div class="tip ok" style="margin-top:8px"><b>怎么算做好了</b><br>${r.chk}</div>`;
  if(r.bad)h+=`<div class="tip" style="margin-top:6px;background:var(--rl);border-color:var(--r-line);color:var(--r-ink)"><b>容易翻车的地方</b><br>${r.bad}</div>`;
  if(r.tip)h+=`<div class="tip" style="font-size:12.5px;margin-top:6px">${r.tip}</div>`;
  const miss=r.m.filter(n=>!haveIng(n));
  if(miss.length){
    h+=`<div class="tip" style="background:var(--rl);border-color:var(--r-line);color:var(--r-ink)">还缺：${miss.join("、")}。买回来就能做。</div>`;
  }
  h+=`<div style="height:12px"></div><button class="btn" onclick="openMealLog('rcp',${i})">记这一餐</button>`;
  h+=`<div style="height:8px"></div><button class="btn ghost" onclick="closeSheet()">关闭</button>`;
  openSheet(h);
}
function openEditLog(i){
  const l=S.logs[i];if(!l)return;
  const num=function(x){return Math.round((+x||0)*10)/10};
  editMeal=l.m||"";
  openSheet('<h3>改这条记录</h3><div class="sm">'+l.d+' ｜ 改完直接覆盖，日期不变</div>'
    +'<label class="fl">名称</label>'
    +'<input type="search" id="el_name" value="'+esc(l.name).replace(/"/g,"&quot;")+'">'
    +'<div class="row3"><div><label class="fl">热量 kcal</label><input type="number" id="el_k" value="'+Math.round(l.kcal||0)+'" inputmode="decimal"></div>'
    +'<div><label class="fl">蛋白 g</label><input type="number" id="el_p" value="'+num(l.p)+'" inputmode="decimal"></div></div>'
    +'<div class="row3"><div><label class="fl">碳水 g</label><input type="number" id="el_c" value="'+num(l.c)+'" inputmode="decimal"></div>'
    +'<div><label class="fl">脂肪 g</label><input type="number" id="el_f" value="'+num(l.f)+'" inputmode="decimal"></div></div>'
    +'<div class="row3"><div><label class="fl">钠 mg</label><input type="number" id="el_na" value="'+Math.round(l.na||0)+'" inputmode="decimal"></div>'
    +'<div><label class="fl">蔬菜 g</label><input type="number" id="el_veg" value="'+Math.round(l.veg||0)+'" inputmode="numeric"></div></div>'
    +'<label class="fl">餐次</label><div class="chips" style="margin-top:0;padding-bottom:0">'
    +[['早','早餐'],['午','午餐'],['晚','晚餐'],['加','加餐'],['','不分']].map(function(p){
        return '<span class="chip'+((l.m||'')===p[0]?' on':'')+'" data-emeal="'+p[0]+'" onclick="setEditMeal(\''+p[0]+'\')">'+p[1]+'</span>'
      }).join("")+'</div>'
    +'<div style="height:14px"></div><button class="btn" onclick="saveEditLog('+i+')">保存修改</button>'
    +'<div style="height:8px"></div><button class="btn ghost" onclick="closeSheet()">取消</button>');
}
let editMeal="";
function setEditMeal(x){
  editMeal=x;
  document.querySelectorAll("[data-emeal]").forEach(function(el){
    el.classList.toggle("on",el.getAttribute("data-emeal")===x);
  });
}
function saveEditLog(i){
  const l=S.logs[i];if(!l)return;
  const v=function(id){const e=document.getElementById(id);return e?e.value:""};
  const name=String(v("el_name")).trim();
  if(!name){alert("名字不能空");return}
  const k=parseFloat(v("el_k"));
  if(!(k>=0)){alert("热量要填个数字");return}
  l.name=name;l.kcal=k;
  l.p=+v("el_p")||0;l.c=+v("el_c")||0;l.f=+v("el_f")||0;
  l.na=+v("el_na")||0;l.veg=+v("el_veg")||0;
  l.m=editMeal||"";
  save();closeSheet();render();
  const pg=$("page");
  if(pg&&pg.classList.contains("on")&&pageMode==="day")renderDayView();
}
function delLog(i){S.logs.splice(i,1);save();render()}

let logTab="eat";
/* ============ 餐次 ============ */
const MEALS=["早","午","晚","加"];
const MEAL_LABEL={"早":"早餐","午":"午餐","晚":"晚餐","加":"加餐","":"未分餐"};
let logMeal=guessMeal();
/* 补记：默认记到今天；从记录页某一天点「＋」进来就记到那一天 */
var logDay="";
function logDate(){const t=today();return (logDay&&logDay<=t)?logDay:t}
function backfillDay(){return logDay&&logDay!==today()?logDay:""}
/* 记完一条：补记就回那一天，否则照旧回原来的标签页 */
function logDone(tab,msg){
  const bk=backfillDay();
  save();closeSheet();
  if(bk){notice("已补记到 "+bk.slice(5)+(msg?" · "+msg:""));openDay(bk);return}
  if(tab)setTab(tab);
  if(msg)notice("已记录 "+msg);
}
function guessMeal(){const h=new Date().getHours();return h<10?"早":h<15?"午":h<21?"晚":"加"}
function setMeal(x){
  logMeal=x;
  document.querySelectorAll("[data-meal]").forEach(function(el){
    el.classList.toggle("on",el.getAttribute("data-meal")===x);
  });
}
function mealChips(){
  return '<div class="chips" style="margin:8px 0 4px">'
    +MEALS.map(function(m){return '<span class="chip'+(logMeal===m?' on':'')+'" data-meal="'+m+'" onclick="setMeal(\''+m+'\')">'+MEAL_LABEL[m]+'</span>'}).join("")
    +'</div>';
}
function openLogSheet(keep){logTab="eat";cookQ="";if(!keep)logDay="";logMeal=logDay?"晚":guessMeal();renderLogSheet()}
/* 从记录页某一天点「＋」：记到那一天。昨天及以前＝补记 */
function openLogFor(ds){
  logDay=(ds&&ds!==today())?ds:"";
  openLogSheet(1);
}
function openLogCal(){
  calMode="log";
  const d=new Date(logDate()+"T00:00:00");
  calY=d.getFullYear();calM=d.getMonth();renderCal();
}
function renderLogSheet(){
  sheetRedraw=1;
  const bk=backfillDay();
  let h=`<h3>记一笔</h3>`
    +(bk?`<div class="sm" style="margin:0 0 6px">补记到 <b>${dayLabel(bk)}</b>
      <span style="color:var(--g);margin-left:8px" onclick="openLogCal()">改日期</span></div>`
      :`<div class="sm" style="margin-bottom:0">记到哪一餐</div>`)
    +mealChips()+`<div class="chips" style="margin-top:2px">
    <span class="chip ${logTab==='eat'?'on':''}" onclick="setLogTab('eat')">食堂 / 加餐</span>
    <span class="chip ${logTab==='cook'?'on':''}" onclick="setLogTab('cook')">用库存做</span>
    <span class="chip ${logTab==='pick'?'on':''}" onclick="setLogTab('pick')">直接吃库存</span>
  </div>`;
  if(logTab==='eat'){
    h+=`<input type="search" id="lq" placeholder="搜食物，比如 米饭 / 鸡腿 / 苹果" oninput="logSearch(this.value)">
    <div id="llist" style="max-height:44vh;overflow-y:auto;margin-top:8px">${logListHtml("")}</div>`;
  }else if(logTab==='cook'){
    h+=`<div class="sm">选一道，做好后自动扣库存并记账</div>
    <input type="search" id="cq" placeholder="搜菜名或食材，比如 番茄 / 鸡胸 / 荞麦" value="${esc(cookQ)}" oninput="cookSearch(this.value)">
    <div id="clist" style="max-height:40vh;overflow-y:auto;margin-top:8px">${cookPickHtml(cookQ)}</div>`;
  }else{
    h+=`<div class="sm">不用做菜，直接从库存里扣掉你吃掉的部分</div>
    <div style="max-height:46vh;overflow-y:auto">${eatPickHtml()}</div>`;
  }
  openSheet(h);
}
function setLogTab(t){logTab=t;renderLogSheet()}
let cookQ="";
function cookSearch(v){
  cookQ=v;
  const el=document.getElementById("clist");
  if(el)el.innerHTML=cookPickHtml(v);
}
function cookPickHtml(kw){
  const r=recommend(kw||"");
  const kinds={};
  S.inv.forEach(function(x){const f=foodOf(x);if(f&&x.g>0.5)kinds[f.n]=1});
  const nk=Object.keys(kinds).length;
  const total=r.now.length+r.near.length;
  let h='<div class="sm" style="margin:0 0 8px;color:var(--ink3)">库存 '+nk+' 种食材'
    +(r.kw?'　匹配 '+total+' 道':'　能做 '+r.now.length+' 道')+'</div>';
  if(!S.inv.length){
    return h+'<div class="empty">库存是空的<br>先去「食材」页加点东西</div>';
  }
  if(!r.now.length&&!r.near.length){
    return h+(r.kw
      ? '<div class="empty">库存里没有和「'+esc(r.kw)+'」相关的菜<br>换个词试试，或去「食堂 / 加餐」用 AI 拆解</div>'
      : '<div class="empty">当前库存还配不成一道完整的菜<br>加点蛋白或蔬菜就有了</div>');
  }
  if(r.now.length){
    h+='<div class="sec" style="margin-top:2px"><b>现在就能做</b><span>'+r.now.length+' 道</span></div>';
    h+=r.now.map(function(x){
      return '<div class="rec" onclick="openMealLog(\'rcp\','+x.i+',\'stock\')">'
        +'<div class="t"><b>'+esc(x.r.n)+(x.r.myDishIdx!=null?' <span class="badge info" style="font-weight:400;vertical-align:1px">我存的</span>':'')+'</b><em>'+x.r.t+' 分钟</em></div>'
        +'<div class="mac">'+macLine(x.mac)+'</div></div>';
    }).join("");
  }else if(r.kw){
    h+='<div class="empty" style="padding:10px 0 4px">「'+esc(r.kw)+'」现在做不了，下面这些差一样</div>';
  }
  if(r.near.length){
    h+='<div class="sec"><b>还差一点</b><span>'+r.near.length+' 道</span></div>';
    h+=r.near.map(function(x){
      return '<div class="rec" onclick="openRcp('+x.i+')">'
        +'<div class="t"><b>'+esc(x.r.n)+(x.r.myDishIdx!=null?' <span class="badge info" style="font-weight:400;vertical-align:1px">我存的</span>':'')+'</b><em>'+x.r.t+' 分钟</em></div>'
        +'<div class="mac">'+macLine(x.mac)+'</div>'
        +'<div class="badges">'+x.miss.map(function(n){return '<span class="badge warn">需买：'+esc(n)+'</span>'}).join("")+'</div></div>';
    }).join("");
  }
  return h;
}
function allDish(){return DISH.concat(S.myDish||[])}
function dishMacro(d,mult){
  const m=mult||1;let k=0,p=0,f=0,c=0,g=0,na=0,fib=0,ca=0,fe=0,vc=0;
  (d.i||[]).forEach(function(it){
    const x=BY[it[0]];if(!x)return;
    const r=it[1]*m/100;
    k+=x.kcal*r;p+=x.p*r;f+=x.f*r;c+=x.c*r;g+=it[1]*m;na+=(x.na||0)*r;
    fib+=(x.fib||0)*r;ca+=(x.ca||0)*r;fe+=(x.fe||0)*r;vc+=(x.vc||0)*r;
  });
  return {kcal:Math.round(k),p:Math.round(p),f:Math.round(f),c:Math.round(c),g:Math.round(g),na:Math.round(na),
    fib:Math.round(fib*10)/10,ca:Math.round(ca),fe:Math.round(fe*10)/10,vc:Math.round(vc*10)/10};
}
function logListHtml(kw){
  const mine=(S.myDish||[]).filter(function(d){return !kw||d.n.indexOf(kw)>-1})
    .slice().sort(function(x,y){return (y.use||0)-(x.use||0)});
  const built=DISH.filter(function(d){return !kw||d.n.indexOf(kw)>-1});
  let h="";
  if(mine.length){
    h+='<div class="sec"><b>你存过的</b><span>用过越多排越前</span></div>';
    h+=mine.slice(0,10).map(function(d){
      const m=dishMacro(d,1),idx=(S.myDish||[]).indexOf(d);
      return '<div class="food" onclick="openMealLog(\'myDish\','+idx+')">'
        +'<div class="info"><div class="nm">'+esc(d.n)
        +'<span class="badge info">我存的'+(d.use?' · 用过'+d.use+'次':'')+'</span></div>'
        +'<div class="mt">'+m.g+'g · '+m.kcal+' kcal · 蛋白 '+m.p+'g · 钠 '+m.na+'mg</div></div>'
        +'<button class="add">选</button></div>';
    }).join("");
  }
  if(built.length){
    h+='<div class="sec"><b>内置菜品</b><span>按配方算，可调份数</span></div>';
    h+=built.slice(0,14).map(function(d){
      const m=dishMacro(d,1),idx=DISH.indexOf(d);
      return '<div class="food" onclick="pickDish('+idx+',0)">'
        +'<div class="info"><div class="nm">'+esc(d.n)+'</div>'
        +'<div class="mt">一份 '+m.g+'g · '+m.kcal+' kcal · 蛋白 '+m.p+'g</div></div>'
        +'<button class="add">选</button></div>';
    }).join("");
  }
  if(kw&&!mine.length&&!built.length){
    h+='<div class="card" style="margin:10px 0"><button class="btn ghost" onclick="aiDish('
      +JSON.stringify(kw).replace(/"/g,"&quot;")+')">✦ 库里没有「'+esc(kw)+'」？让 AI 拆解配方</button></div>';
  }
  const foods=F.filter(function(f){return nameHit(f,kw)}).slice(0,30);
  h+='<div class="sec"><b>食材</b><span>单个食材的营养</span></div>';
  h+=foods.map(function(f){
    return '<div class="food" onclick="pickLog('+f.id+')"><div class="info">'
      +'<div class="nm">'+f.n+'<span class="badge mut">'+f.ug+'g/'+f.un+'</span></div>'
      +'<div class="mt">'+f.kcal+' kcal · 蛋白 '+f.p+'g</div></div>'
      +'<button class="add">选</button></div>';
  }).join("");
  return h;
}
let curDish=null,curMult=1,curDishIdx=-1,curDishMine=false;
function pickDish(i,isMine){
  curDishMine=!!isMine;
  curDishIdx=i;
  curDish=isMine?(S.myDish||[])[i]:DISH[i];
  curMult=1;sheetPushNext=1;renderDish();
}
function setMult(v){curMult=v;renderDish()}
function renderDish(){
  sheetRedraw=1;
  const d=curDish,one=dishMacro(d,1),m=dishMacro(d,curMult);
  openSheet('<h3>'+esc(d.n)+'</h3><div class="sm">'
    +(d.note?esc(d.note)+'<br>':'')+'一份按 '+one.g+'g 计</div>'
    +'<div class="chips">'+[0.5,1,1.5,2].map(function(v){
      return '<span class="chip '+(curMult===v?'on':'')+'" onclick="setMult('+v+')">'+v+' 份</span>';
    }).join("")+'</div>'
    +'<div class="preview"><div class="l"><b>合计</b><b>'+m.kcal+' kcal</b></div>'
    +'<div class="l"><span>约 '+m.g+'g</span></div>'
    +'<div class="l"><span>蛋白 '+m.p+'g ｜ 碳水 '+m.c+'g ｜ 脂肪 '+m.f+'g</span></div>'
    +'<div class="l"><span>钠 '+m.na+'mg'+(m.na>800?'　⚠ 偏高':'')+'</span></div></div>'
    +'<div class="sm" style="margin-bottom:0">记到哪一餐</div>'+mealChips()
    +'<button class="btn" onclick="doDish()">记下</button>'
    +'<div style="height:8px"></div><button class="btn ghost" onclick="openLogSheet()">返回</button>');
}
function doDish(){
  const m=dishMacro(curDish,curMult);
  const nm=curDish.n+(curMult!==1?" ×"+curMult:"");
  S.logs.push({d:logDate(),m:logMeal,name:nm,kcal:m.kcal,p:m.p,f:m.f,c:m.c,na:m.na,veg:0,
    fib:m.fib,ca:m.ca,fe:m.fe,vc:m.vc});
  if(curDishMine&&S.myDish&&S.myDish[curDishIdx]){
    S.myDish[curDishIdx].use=(S.myDish[curDishIdx].use||0)+1;
  }
  logDone("log");
}
let aiDishName="",aiDishItems=[],aiDishNote="",aiPickIdx=-1;
const OIL_ALIAS={"食用油":"橄榄油","植物油":"橄榄油","色拉油":"橄榄油","调和油":"橄榄油","玉米油":"橄榄油","花生油":"橄榄油","菜籽油":"橄榄油","大豆油":"橄榄油","葵花油":"橄榄油","油":"橄榄油","植物油（豆油）":"橄榄油"};
const NAME_EXTRA={"鸡腿（去皮）":"鸡腿肉（去皮）","鸡腿肉（去皮）":"鸡腿肉（去皮）","去皮鸡腿":"鸡腿肉（去皮）","鸡腿肉去皮":"鸡腿肉（去皮）","鸭腿（去皮）":"鸭腿肉（去皮）","去皮鸭腿":"鸭腿肉（去皮）","鸭腿":"鸭腿肉（带皮）","鸭腿肉":"鸭腿肉（带皮）","排骨":"猪小排","猪排骨":"猪小排","小排":"猪小排","大排":"猪大排","肋排":"猪小排","肉末":"猪肉（瘦）","猪肉末":"猪肉（瘦）","肉丝":"猪里脊","肉片":"猪里脊","里脊":"猪里脊","鸡胸":"鸡胸肉","鸡腿":"鸡腿肉","鸡腿肉丁":"鸡腿肉","牛柳":"牛里脊","牛肉":"牛里脊","虾":"虾仁","虾仁（鲜）":"虾仁","蛋液":"鸡蛋","鸡蛋液":"鸡蛋","雞蛋":"鸡蛋","米饭一碗":"米饭","白饭":"米饭","面条":"挂面","青菜":"小白菜","油菜":"小白菜","淀粉（玉米）":"淀粉","生粉":"淀粉","蒜末":"大蒜","蒜":"大蒜","姜末":"姜","姜片":"姜","葱花":"大葱","葱":"大葱"};
function normName(s){
  return String(s==null?"":s)
    .replace(/[（(][^）)]*[）)]/g,"")
    .replace(/[【\[][^】\]]*[】\]]/g,"")
    .replace(/^(新鲜|鲜|生|熟|干)/,"")
    .trim();
}
function matchFood(raw){
  const n=String(raw==null?"":raw).trim();
  if(!n)return null;
  if(BY[n])return {n:BY[n].n,how:"同名"};
  const base=normName(n);
  let al=OIL_ALIAS[n]||NAME_EXTRA[n]||ALIAS[n];
  if(al&&BY[al])return {n:al,how:"同义词"};
  if(base&&BY[base])return {n:BY[base].n,how:"去括号"};
  al=OIL_ALIAS[base]||NAME_EXTRA[base]||ALIAS[base];
  if(al&&BY[al])return {n:al,how:"同义词"};
  if(base.length>=2){
    let best=null;
    for(const k in BY){
      if(k.length<2)continue;
      if(n.indexOf(k)>-1||k.indexOf(base)>-1){
        if(!best||k.length>best.length)best=k;
      }
    }
    if(best)return {n:best,how:"近似"};
  }
  return null;
}
function aiDish(name){
  const q=String(name||"").trim();
  const all=allDish();
  const hit=all.filter(function(d){return d.n===q})[0]
          ||all.filter(function(d){return q&&(d.n.indexOf(q)>-1||q.indexOf(d.n)>-1)})[0];
  if(hit){
    const mm=dishMacro(hit,1);
    const isMine=(S.myDish||[]).indexOf(hit)>-1;
    const recipe=(hit.i||[]).map(function(x){return x[0]+" "+x[1]+"g"}).join("、");
    if(confirm("「"+hit.n+"」库里已经有了"+(isMine?"（你存的）":"（内置）")+"：\n"
      +(recipe?recipe+"\n":"")+"约 "+mm.kcal+" kcal · 蛋白 "+mm.p+"g\n\n"
      +"点「确定」直接用这个记账，点「取消」还是让 AI 重拆一遍。")){
      curDish=hit;curDishMine=isMine;curMult=1;
      curDishIdx=isMine?(S.myDish||[]).indexOf(hit):DISH.indexOf(hit);
      renderDish();return;
    }
  }
  if(!S.ai||!S.ai.key){alert("「"+q+"」库里没有，AI 拆解需要先在「记录」页填接口和 Key");return}
  aiDishName=name;aiDishItems=[];aiEstKcal=null;aiEstLoading=false;
  openSheet('<h3>AI 拆解：'+esc(name)+'</h3><div class="sm">AI 只拆配料和克数，热量由本地成分表算</div>'
    +'<div class="empty loading"><span class="spinner"></span>正在拆解…（5–20 秒）</div>');
  const names=F.map(f=>f.n).join("、");
  const sys="你是营养师助手。用户要估算食堂一份菜的热量，你只负责拆解配料和克数，不做热量计算。只输出 JSON。";
  const user="菜品："+name+"\n\n请拆解这一份的配料与克数。要求：\n"
   +"1. 每项的 name 必须从下面这个列表里【一字不改】地复制，不要加括号、不要加「去皮/去骨/切片/丝」等说明：\n"+names+"\n"
   +"2. 处理方式（去皮、去骨、切丝）写在 prep 字段，不要写进 name\n"
   +"3. 油统一写「橄榄油」，用量按做法判断：\n    蒸 / 煮 / 白灼 / 凉拌 / 卤 → 0–3g\n    普通炒菜 → 8–12g\n    红烧 / 干煸 / 过油 / 糖醋 / 干锅 → 15–25g\n"
   +"4. 整份总重控制在 120–380g\n"
   +"5. 带皮、带骨的食材（鸡腿、排骨、鱼）g 给的是可食部分净重\n"
   +"6. 只输出 JSON，不要任何解释\n\n"
   +'格式：{"name":"菜名","items":[{"name":"食材","g":150,"prep":"去皮"}],"note":"一句说明"}';
  const payload={model:(S.ai.model||"deepseek-flash"),temperature:0.3,max_tokens:900,
    messages:[{role:"system",content:sys},{role:"user",content:user}],
    response_format:{type:"json_object"}};
  aiPost(payload,function(t){renderAiDish(t)});
}
function renderAiDish(t){
  if(!t||String(t).indexOf("err:")===0){
    openSheet('<h3>拆解失败</h3><div class="tip">'+esc(String(t||"").slice(0,200))+'</div><button class="btn ghost" onclick="sheetBack()">返回</button>');
    return;
  }
  let obj=null;
  try{
    const d=JSON.parse(t);
    let c=(d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content)||"";
    c=c.replace(/^```(?:json)?/i,"").replace(/```$/,"").trim();
    const i=c.indexOf("{"),j=c.lastIndexOf("}");
    if(i>-1&&j>i)c=c.slice(i,j+1);
    obj=JSON.parse(c);
  }catch(e){
    openSheet('<h3>拆解失败</h3><div class="tip">返回内容无法解析，再试一次</div><button class="btn ghost" onclick="sheetBack()">返回</button>');
    return;
  }
  aiDishNote=obj.note||"";
  const items=(obj.items||[]).map(function(x){
    const nm=typeof x==="string"?x:(x.name||x.n||"");
    const g=typeof x==="string"?100:(x.g||x.gram||100);
    const prep=typeof x==="string"?"":(x.prep||"");
    let mt=matchFood(nm);
    if(mt&&prep&&/去皮|无皮/.test(prep)){
      const alt=BY[mt.n+"（去皮）"];
      if(alt&&alt.n!==mt.n)mt={n:alt.n,how:"按去皮"};
    }
    return {raw:nm,n:mt?mt.n:null,how:mt?mt.how:null,prep:prep,g:Math.round(+g||0)};
  }).filter(function(x){return x.raw&&x.g>0});
  if(!items.length){
    openSheet('<h3>没拆出配料</h3><div class="tip">AI 没有给出可用的配料，再试一次</div><button class="btn ghost" onclick="sheetBack()">返回</button>');
    return;
  }
  aiDishItems=items;
  renderAiDishSheet();
  askEstimate();
}
let aiEstKcal=null,aiEstLo=0,aiEstHi=0,aiEstNote="",aiEstLoading=false;
function askEstimate(){
  const nm=aiDishName||"";
  if(!nm)return;
  aiEstKcal=null;aiEstLoading=true;aiEstNote="";
  const payload={model:(S.ai.model||"deepseek-flash"),temperature:0.2,max_tokens:300,
    messages:[
      {role:"system",content:"你是中餐营养估算专家。只输出 JSON，不要拆解配方。"},
      {role:"user",content:"请独立估算：中国大学食堂常见的一份「"+nm+"」大约多少千卡（整份，不含米饭）。\n"
        +"只凭经验估，不要列配料、不要拆解。\n"
        +'输出：{"kcal":整数,"lo":下限,"hi":上限,"note":"一句话依据，20字内"}'}
    ],
    response_format:{type:"json_object"}};
  aiPost(payload,function(t){
    aiEstLoading=false;
    try{
      const d=JSON.parse(t);
      let c=(d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content)||"";
      c=c.replace(/^```(?:json)?/i,"").replace(/```$/,"").trim();
      const i=c.indexOf("{"),j=c.lastIndexOf("}");
      if(i>-1&&j>i)c=c.slice(i,j+1);
      const o=JSON.parse(c);
      const k=Math.round(+o.kcal||0);
      if(k>0){aiEstKcal=k;aiEstLo=Math.round(+o.lo||0);aiEstHi=Math.round(+o.hi||0);aiEstNote=o.note||""}
    }catch(e){aiEstKcal=null}
    updateAiTotal();
  });
}
function itemsOfDish(){
  return aiDishItems.filter(function(x){return x.n}).map(function(x){return [x.n,x.g]});
}
function renderAiDishSheet(){
  sheetRedraw=1;
  const un=aiDishItems.filter(function(x){return !x.n});
  const unG=un.reduce(function(a,x){return a+x.g},0);
  let h='<h3>'+esc(aiDishName||"拆解结果")+'</h3><div class="sm">'
    +(aiDishNote?esc(aiDishNote)+'<br>':'')
    +'每项都能单独改克数、单独换食材，合计实时重算</div>';
  if(un.length)h+='<div class="tip" style="background:var(--rl);border-color:var(--r-line);color:var(--r-ink)">有 '
    +un.length+' 项没对上本地库（共 '+Math.round(unG)+'g），点「选食材」指定，否则不计入合计</div>';
  h+='<div style="max-height:42vh;overflow-y:auto">';
  aiDishItems.forEach(function(x,i){
    const ok=!!x.n;
    const f=ok?BY[x.n]:null;
    const g=x.g;
    h+='<div style="border:1px solid '+(ok?'var(--line)':'var(--r-line)')+';border-radius:10px;padding:9px 11px;margin-bottom:7px;background:'+(ok?'#fff':'#FDF6F6')+'">'
      +'<div style="display:flex;align-items:center;gap:8px">'
      +'<span style="flex:1;font-size:14px;font-weight:500">'+esc(ok?x.n:x.raw)+'</span>'
      +(ok?'<span style="font-size:11px;color:var(--ink4);white-space:nowrap">'+x.how+'</span>'
          :'<button class="add" style="padding:2px 8px;white-space:nowrap" onclick="openAiPick('+i+')">选食材</button>')
      +'<input type="number" value="'+g+'" inputmode="decimal" style="width:70px;text-align:right" oninput="setAiDishG('+i+',this.value)">'
      +'</div>';
    if(ok){
      h+='<div id="nut'+i+'" style="font-size:11.5px;color:var(--ink3);margin-top:5px;line-height:1.5">'+rowNutText(i)+'</div>';
    }else{
      h+='<div style="font-size:11.5px;color:var(--r);margin-top:5px">库里没有「'+esc(x.raw)+'」，点「选食材」指定</div>';
    }
    h+='</div>';
  });
  h+='</div><div class="preview" id="ai_total"></div>'
    +'<button class="btn" onclick="doAiDish()">记下并问是否存为常用</button>'
    +'<div style="height:8px"></div><button class="btn ghost" onclick="sheetBack()">返回</button>';
  openSheet(h);
  updateAiTotal();
}
function updateAiTotal(){
  const ok=aiDishItems.filter(function(x){return x.n});
  const un=aiDishItems.filter(function(x){return !x.n});
  const m=dishMacro({n:aiDishName,i:itemsOfDish()},1);
  const unG=un.reduce(function(a,x){return a+x.g},0);
  const el=document.getElementById("ai_total");
  if(!el)return;
  let h='<div class="l"><b>已计入合计</b><b>'+m.kcal+' kcal</b></div>'
    +'<div class="l"><span>约 '+m.g+'g</span></div>'
    +'<div class="l"><span>蛋白 '+m.p+'g ｜ 碳水 '+m.c+'g ｜ 脂肪 '+m.f+'g</span></div>'
    +'<div class="l"><span>钠 '+m.na+'mg'+(m.na>800?'　⚠ 偏高':'')+'</span></div>';
  if(un.length)h+='<div class="l"><span style="color:var(--r)">未计入 '+un.length+' 项，共 '+Math.round(unG)+'g</span></div>';
  // 合理性校验：抓自相矛盾的结果
  const warn=[];
  if(m.g>=120&&m.kcal<120)warn.push("总重 "+m.g+"g 却只有 "+m.kcal+" kcal，多半有食材没计入");
  if(m.na>700&&m.kcal<250)warn.push("钠 "+m.na+"mg 但热量仅 "+m.kcal+" kcal，比例不对");
  const hasMeat=aiDishItems.some(function(x){return x.n&&BY[x.n].cat==="protein"&&x.g>=50});
  if(hasMeat&&m.p<8)warn.push("有蛋白类食材（≥50g）但蛋白只有 "+m.p+"g，检查是否漏项");
  let estOk="",estMid="";
  if(aiEstLoading){
    h+='<div class="l"><span style="color:var(--ink3)"><span class="spinner" style="width:12px;height:12px;margin-right:5px"></span>正在让 AI 独立核对热量…</span></div>';
  }else if(aiEstKcal){
    const dd=Math.round((m.kcal-aiEstKcal)/aiEstKcal*100), ad=Math.abs(dd);
    const rng=aiEstHi?"（"+aiEstLo+"–"+aiEstHi+" kcal）":"";
    if(ad>40){
      warn.push("AI 凭经验估 "+aiEstKcal+" kcal"+rng+"，本地算 "+m.kcal+" kcal，相差 "+ad+"%"
        +(dd<0?"。本地偏低，多半还有漏项":"。本地偏高，检查油和糖是否给多了"));
    }else if(ad>25){
      estMid="AI 独立估算 "+aiEstKcal+" kcal"+rng+"，与本地相差 "+ad+"%，在估算误差范围内";
    }else{
      estOk="AI 独立估算 "+aiEstKcal+" kcal"+rng+"，与本地相差 "+ad+"%，互相印证";
    }
  }
  if(warn.length)h+='<div class="l"><span style="color:var(--r);line-height:1.5">⚠ '+warn.join("<br>⚠ ")+'</span></div>';
  if(estOk)h+='<div class="l"><span style="color:var(--ok-ink);line-height:1.5">✓ '+estOk+'</span></div>';
  if(estMid)h+='<div class="l"><span style="color:var(--ink3);line-height:1.5">≈ '+estMid+'</span></div>';
  el.innerHTML=h;
}
function rowNutText(i){
  const x=aiDishItems[i];if(!x||!x.n)return "";
  const f=BY[x.n];if(!f)return "";
  const g=x.g;
  return Math.round(f.kcal*g/100)+' kcal · 蛋白 '+(f.p*g/100).toFixed(1)+'g · 碳水 '+(f.c*g/100).toFixed(1)
    +'g · 脂肪 '+(f.f*g/100).toFixed(1)+'g · 钠 '+Math.round((f.na||0)*g/100)+'mg'
    +(x.prep?'　｜ '+esc(x.prep):'');
}
function updateRowNut(i){
  const el=document.getElementById("nut"+i);
  if(!el)return;
  el.innerHTML=rowNutText(i);
}
function setAiDishG(i,v){
  const n=parseFloat(v);
  if(isNaN(n)||n<0)return;
  aiDishItems[i].g=Math.round(n);
  updateRowNut(i);
  updateAiTotal();
}
function openAiPick(i){
  aiPickIdx=i;
  const x=aiDishItems[i];
  const kw=normName(x.raw);
  openSheet('<h3>对应库里哪个食材</h3><div class="sm">AI 写的是「'+esc(x.raw)+'」</div>'
    +'<input type="search" id="apq" placeholder="搜食材名" value="'+esc(kw)+'" oninput="aiPickSearch(this.value)">'
    +'<div id="aplist" style="max-height:44vh;overflow-y:auto;margin-top:8px">'+aiPickList(kw)+'</div>'
    +'<div style="height:8px"></div><button class="btn ghost" onclick="sheetBack()">返回修改</button>');
}
function aiPickList(kw){
  const list=F.filter(function(f){return nameHit(f,kw)}).slice(0,30);
  if(!list.length)return '<div class="empty">没找到，换个词试试</div>';
  return list.map(function(f){
    return '<div class="food" onclick="pickAiFood('+f.id+')">'
      +'<div class="info"><div class="nm">'+f.n+'<span class="badge mut">'+f.ug+'g/'+f.un+'</span></div>'
      +'<div class="mt">'+f.kcal+' kcal · 蛋白 '+f.p+'g · 钠 '+Math.round(f.na||0)+'mg</div></div>'
      +'<button class="add">选</button></div>';
  }).join("");
}
function aiPickSearch(v){document.getElementById("aplist").innerHTML=aiPickList(v)}
function pickAiFood(id){
  const f=F[id];
  if(!f||aiPickIdx<0)return;
  aiDishItems[aiPickIdx].n=f.n;
  aiDishItems[aiPickIdx].how="手动";
  if(sheetStack.length)sheetStack.pop();      /* 选择页是一次性的：选完直接回到上一层 */
  renderAiDishSheet();
}
function doAiDish(){
  const ok=aiDishItems.filter(function(x){return x.n});
  const un=aiDishItems.filter(function(x){return !x.n});
  const unG=un.reduce(function(a,x){return a+x.g},0);
  if(!ok.length){alert("一项都没对上本地库，没法计算。至少先指定一项主料。");return}
  if(unG>=30){
    if(!confirm("还有 "+un.length+" 项没指定（共 "+Math.round(unG)+"g），这些不会计入。\n\n继续记账点「确定」，回去指定点「取消」。"))return;
  }
  const d={n:aiDishName||"自定义菜",i:itemsOfDish()};
  const m=dishMacro(d,1);
  S.logs.push({d:logDate(),m:logMeal,name:d.n,kcal:m.kcal,p:m.p,f:m.f,c:m.c,na:m.na,veg:0});
  S.myDish=S.myDish||[];
  let msg="已记账："+d.n+" · "+m.kcal+" kcal · 蛋白 "+m.p+"g";
  const builtIn=DISH.filter(function(x){return x.n===d.n})[0];
  if(builtIn){
    msg+="\n\n内置库里有同名菜，没重复存一份。以后搜「"+d.n+"」直接记，份量不对就调份数。";
  }else{
    const idx=S.myDish.findIndex(function(x){return x.n===d.n});
    if(idx>-1){
      const oldUse=(S.myDish[idx]&&S.myDish[idx].use)||0;
      S.myDish.splice(idx,1);
      S.myDish.push({n:d.n,i:d.i,note:aiDishNote||"AI 拆解，可自行调整",use:oldUse});
      msg+="\n\n已更新「我的菜品」里同名的配方。";
    }else{
      S.myDish.push({n:d.n,i:d.i,note:aiDishNote||"AI 拆解，可自行调整",use:0});
      msg+="\n\n已存进「我的菜品」，下次搜「"+d.n+"」直接可用，不用再调 AI。";
    }
  }
  logDone("log");
  alert(msg);
}
function logSearch(v){$("llist").innerHTML=logListHtml(v)}
let logId=-1;
function eatPickHtml(){
  if(!S.inv.length)return '<div class="empty">库存是空的<br>先去「食材」页加点东西</div>';
  return [...S.inv].sort((a,b)=>remDays(a)-remDays(b)).map(it=>{
    const f=foodOf(it),r=remDays(it);
    if(!f)return "";
    const bd=r<0?'<span class="badge warn">已过期</span>':r<=0?'<span class="badge warn">今天要用</span>':`<span class="badge mut">${r}天</span>`;
    return `<div class="food" onclick="openEat('${it.d}',${it.id})">
      <div class="info"><div class="nm">${f.n}${bd}</div>
      <div class="mt">剩 ${Math.round(it.g)}g · ${Math.round(f.kcal*it.g/100)} kcal</div></div>
      <button class="add">吃掉</button></div>`;
  }).join("");
}
function openEat(d,id){
  const b=S.inv.find(x=>x.d===d&&x.id===id);
  if(!b)return;
  const f=foodOf(b),left=Math.round(b.g);
  if(!f)return;
  const def=Math.min(f.ug,left);
  openSheet(`<h3>${f.n}</h3><div class="sm">库存剩 ${left}g · ${f.kcal} kcal/100g<br>吃掉多少？</div>
  <input type="number" id="eatg" value="${def}" inputmode="decimal" oninput="calcEat('${d}',${id})">
  <div class="chips" style="margin-top:10px">
    <span class="chip" onclick="setEat(${Math.round(left/2)})">一半</span>
    <span class="chip" onclick="setEat(${left})">全吃掉</span>
  </div>
  <div class="preview" id="epv"></div>
  <button class="btn" onclick="doEat('${d}',${id})">确认吃掉</button>
  <div style="height:8px"></div><button class="btn ghost" onclick="sheetBack()">返回</button>`);
  calcEat(d,id);
}
function setEat(v){const e=document.getElementById("eatg");if(e){e.value=v;e.dispatchEvent(new Event("input"))}}
function calcEat(d,id){
  const f=foodOf(S.inv.find(x=>x.d===d&&x.id===id)),el=document.getElementById("eatg"),pv=document.getElementById("epv");
  if(!f)return;
  const g=el?parseFloat(el.value):0;
  if(!pv)return;
  if(!g||g<=0){pv.innerHTML='<span style="color:var(--ink3)">填个克数</span>';return}
  pv.innerHTML=`<div class="l"><b>扣掉</b><b>${Math.round(g)}g</b></div>
  <div class="l"><span>热量 ${Math.round(f.kcal*g/100)} kcal ｜ 蛋白 ${(f.p*g/100).toFixed(1)}g</span></div>
  <div class="l"><span>碳水 ${(f.c*g/100).toFixed(1)}g ｜ 脂肪 ${(f.f*g/100).toFixed(1)}g</span></div>`;
}
function doEat(d,id){
  const el=document.getElementById("eatg");
  const g=el?parseFloat(el.value):0;
  if(!g||g<=0)return;
  const cur=S.inv.find(x=>x.d===d&&x.id===id);
  const f=foodOf(cur);
  if(!f)return;
  let need=g;
  S.inv.filter(x=>foodName(x)===f.n).sort((a,b)=>a.d.localeCompare(b.d)).forEach(b=>{
    if(need<=0)return;
    const use=Math.min(need,b.g);b.g-=use;need-=use;
  });
  S.inv=S.inv.filter(x=>x.g>0.5);
  S.logs.push({d:logDate(),m:logMeal,name:f.n+" "+Math.round(g)+"g",kcal:f.kcal*g/100,p:f.p*g/100,f:f.f*g/100,c:f.c*g/100,na:(f.na||0)*g/100,veg:f.cat==="veg"?g:0,fib:Math.round((f.fib||0)*g/100*10)/10,ca:Math.round((f.ca||0)*g/100),fe:Math.round((f.fe||0)*g/100*10)/10,vc:Math.round((f.vc||0)*g/100*10)/10});
  logDone("log");
}
function pickLog(id){
  logId=id;const f=F[id];
  openSheet(`<h3>${f.n}</h3><div class="sm">吃了多少克？1${f.un} ≈ ${f.ug}g</div>
  <input type="number" id="addg" value="${f.ug}" inputmode="decimal">
  <div class="chips" style="margin-top:10px">
    <span class="chip" onclick="setAdd(${f.ug})">1${f.un}</span>
    <span class="chip" onclick="setAdd(${f.ug*2})">2${f.un}</span>
    <span class="chip" onclick="setAdd(${Math.round(f.ug/2)})">半份</span>
  </div>
  <div style="height:14px"></div><button class="btn" onclick="doLog()">记下</button>
  <div style="height:8px"></div><button class="btn ghost" onclick="renderLogSheet()">换一个</button>`);
}
function doLog(){
  const g=parseFloat($("addg").value);
  if(!g||g<=0)return;
  const f=F[logId];
  S.logs.push({d:logDate(),m:logMeal,name:f.n+" "+Math.round(g)+"g",kcal:f.kcal*g/100,p:f.p*g/100,f:f.f*g/100,c:f.c*g/100,na:(f.na||0)*g/100,veg:f.cat==="veg"?g:0,fib:Math.round((f.fib||0)*g/100*10)/10,ca:Math.round((f.ca||0)*g/100),fe:Math.round((f.fe||0)*g/100*10)/10,vc:Math.round((f.vc||0)*g/100*10)/10});
  logDone("log");
}
function toggleKey(){
  const el=document.getElementById("ai_key");
  el.type=el.type==="password"?"search":"password";
}
function setModel(m){
  document.getElementById("ai_model").value=m;
}
function aiBase(){return ((S.ai&&S.ai.base)||"https://api.deepseek.com/v1").replace(/\/$/,"")}
function testAI(){
  const key=(document.getElementById("ai_key").value||"").trim();
  if(!key){alert("先填 Key");return}
  const out=document.getElementById("ai_test");
  out.innerHTML='<div class="empty loading"><span class="spinner"></span>正在连接…</div>';
  const url=((document.getElementById("ai_base").value||"https://api.deepseek.com/v1").replace(/\/$/,""))+"/models";
  const cb=function(t){
    if(!t||String(t).indexOf("err:")===0){
      out.innerHTML='<div class="tip">连接失败：'+String(t||"").slice(0,160)+'</div>';return;
    }
    try{
      const d=JSON.parse(t);
      const ids=(d.data||[]).map(x=>x.id);
      if(!ids.length){out.innerHTML='<div class="tip">没有返回模型</div>';return}
      out.innerHTML='<div class="tip ok">连接正常，这个 key 可用下列模型，点一下填入：</div><div class="chips" style="flex-wrap:wrap">'
        +ids.map(i=>'<span class="chip" onclick="setModel(\''+i+'\')">'+i+'</span>').join("")+'</div>';
    }catch(e){out.innerHTML='<div class="tip">返回格式异常</div>'}
  };
  if(window.AndroidBridge&&window.AndroidBridge.aiGet){
    window.__aiCb=cb;
    window.AndroidBridge.aiGet(url,key);
    return;
  }
  fetch(url,{headers:{"Authorization":"Bearer "+key}}).then(r=>r.text()).then(cb).catch(e=>cb("err:"+e.message));
}
function saveAI(){
  S.ai={base:(document.getElementById("ai_base").value||"").trim(),
        key:(document.getElementById("ai_key").value||"").trim(),
        model:(document.getElementById("ai_model").value||"").trim()||"deepseek-flash"};
  save();alert("已保存");
}
function openEditRcp(i){
  const r=(S.myRcp||[])[i];
  if(!r){alert("没找到这条");return}
  openSheet('<h3>编辑食谱</h3><div class="sm">食材清单不改，只改名字、做法和提示</div>'
    +'<label class="fl">菜名</label><input type="search" id="er_name" value="'+esc(r.n).replace(/"/g,"&quot;")+'">'
    +'<div class="sec"><b>食材</b><span>'+(r.m||[]).length+' 样</span></div>'
    +(r.m||[]).map(function(x){return '<span class="badge info" style="margin:0 4px 4px 0;display:inline-block">'+esc(x)+'</span>'}).join("")
    +'<label class="fl">做法（一行一步）</label>'
    +'<textarea id="er_steps" style="min-height:140px">'+esc((r.s||[]).join("\n"))+'</textarea>'
    +'<label class="fl">关键提示（可留空）</label>'
    +'<textarea id="er_tip" style="min-height:60px">'+esc(r.tip||"")+'</textarea>'
    +'<div style="height:12px"></div><button class="btn" onclick="saveEditRcp('+i+')">保存修改</button>'
    +'<div style="height:8px"></div><button class="btn ghost" style="color:var(--r)" onclick="delRcpFromEdit('+i+')">删除这条</button>'
    +'<div style="height:8px"></div><button class="btn ghost" onclick="closeSheet()">取消</button>');
}
function saveEditRcp(i){
  const r=(S.myRcp||[])[i];
  if(!r)return;
  const nm=String((document.getElementById("er_name")||{}).value||"").trim();
  if(!nm){alert("菜名不能空");return}
  const dup=(S.myRcp||[]).findIndex(function(x,k){return k!==i&&x.n===nm});
  const inBuilt=RCP.some(function(x){return x.n===nm});
  if(dup>-1||inBuilt){
    alert("已经有叫「"+nm+"」的食谱了，换个名字。");
    return;
  }
  const st=String((document.getElementById("er_steps")||{}).value||"").split(/\n/)
    .map(function(x){return x.trim()}).filter(Boolean);
  const tp=String((document.getElementById("er_tip")||{}).value||"").trim();
  r.n=nm;
  r.s=st.length?st:r.s;
  r.tip=tp;
  save();closeSheet();render();
  alert("已更新「"+nm+"」");
}
function delRcpFromEdit(i){
  const r=(S.myRcp||[])[i];
  if(!r)return;
  if(!confirm("删除「"+r.n+"」？"))return;
  S.myRcp.splice(i,1);save();closeSheet();render();
}
function delMyRcp(i){
  if(!confirm("删除这道自定义食谱？"))return;
  S.myRcp.splice(i,1);save();render();
}
function aiPost(payload,cb){
  const ai=S.ai||{};
  const base=(ai.base||"https://api.deepseek.com/v1").replace(/\/$/,"");
  const url=base+"/chat/completions";
  const body=JSON.stringify(payload);
  if(window.AndroidBridge&&window.AndroidBridge.aiPost){
    window.__aiCb=cb;
    window.AndroidBridge.aiPost(url,ai.key,body);
    return;
  }
  fetch(url,{method:"POST",headers:{"Content-Type":"application/json","Authorization":"Bearer "+ai.key},body})
    .then(r=>r.text()).then(t=>cb(t)).catch(e=>cb("err:"+e.message));
}
let aiResults=[];
function openAI(){
  if(!S.ai||!S.ai.key){alert("先在「记录」页底部填 AI 接口和 Key");return}
  const uniq=[...new Set(S.inv.map(foodName).filter(Boolean))];
  openSheet(`<h3>用 AI 写一道</h3><div class="sm">只用水煮、蒸、焯、焖；热量和营养由本地成分表重算</div>
  <label class="fl">手上有什么（可以改、可以写想吃的）</label>
  <textarea id="ai_in">${uniq.join("、")||"鸡蛋、番茄"}</textarea>
  <label class="fl">额外要求（可选）</label>
  <input type="search" id="ai_q" placeholder="比如：想喝汤 / 15分钟内 / 蛋白高一点">
  <div style="height:12px"></div>
  <button class="btn" onclick="runAI()">生成 3 个方案</button>
  <div id="ai_out" style="margin-top:14px"></div>`);
}
function runAI(noFmt){
  const ing=(document.getElementById("ai_in").value||"").trim();
  const q=(document.getElementById("ai_q").value||"").trim();
  if(!ing){alert("先写手上有什么");return}
  document.getElementById("ai_out").innerHTML='<div class="empty loading"><span class="spinner"></span>AI 正在想…（通常 5–20 秒）</div>';
  const sys="你是中式家常菜顾问。用户只有一台额定600W的电煮锅，只能水煮、蒸、焯、焖，没有炒锅、没有烤箱、没有冰箱。只输出 JSON。";
  const user="用户现有食材："+ing+"\n额外要求："+(q||"无")+"\n\n"
   +"要求：\n1. 只用上述食材，最多额外加一种常见调味\n2. 必须能用水煮/蒸/焯/焖完成，禁止炒、煎、炸、烤\n"
   +"3. 给 3 道菜\n4. must 数组里的食材名必须严格从\"用户现有食材\"里原样复制，不要改写法\n"
   +"5. steps 每条不超过 18 个字，desc 不超过 20 个字，tip 不超过 25 个字\n"
   +"6. 下面这些菜已经有了，不要再推荐，换个思路："+ALL().map(function(x){return x.n}).join("、")+"\n"
   +"7. 只输出 JSON 本身，一行都不要多写\n\n"
   +'格式：{"recipes":[{"name":"菜名","time":18,"desc":"一句话","must":["食材1"],"opt":[],"steps":["步骤1","步骤2","步骤3"],"tip":"提示"}]}';
  const payload={model:(S.ai.model||"deepseek-flash"),temperature:0.6,max_tokens:2600,
    messages:[{role:"system",content:sys},{role:"user",content:user}]};
  if(!noFmt)payload.response_format={type:"json_object"};
  aiPost(payload,function(t){
    if(!noFmt&&/response_format|json_object|not support/i.test(String(t))){
      runAI(true);return;
    }
    document.getElementById("ai_out").innerHTML=handleAI(t);
  });
}
function handleAI(t){
  if(!t)return '<div class="tip">没有返回内容</div>';
  if(t.indexOf("err:")===0){
    let msg=String(t).slice(4);
    const mm=msg.match(/"message"\s*:\s*"([^"]+)"/);
    if(mm)msg=mm[1];
    let hint="";
    if(msg.indexOf("model")>-1||msg.indexOf("Model")>-1)hint="点上面的「测试连接取列表」能看到这个 key 支持哪些模型。";
    else if(msg.indexOf("401")>-1||msg.indexOf("auth")>-1||msg.indexOf("Auth")>-1)hint="Key 不对或已作废，去后台重新建一个。";
    else if(msg.indexOf("402")>-1||msg.indexOf("balance")>-1)hint="账户余额不足。";
    else hint="如果是纯网络错误，检查手机是否联网；APK 版走原生请求，不受跨域限制。";
    return '<div class="tip">调用失败：'+msg+'<br><br>'+hint+'</div>';
  }
  let content="";
  try{
    const d=JSON.parse(t);
    content=(d.choices&&d.choices[0]&&d.choices[0].message&&d.choices[0].message.content)||"";
  }catch(e){return '<div class="tip">接口返回的不是标准响应</div><details style="margin-top:8px"><summary style="font-size:12px;color:var(--ink3)">看原始返回</summary><div style="font-size:11px;color:var(--ink3);word-break:break-all;margin-top:6px">'+esc(t.slice(0,600))+'</div></details>'}
  if(!content.trim())return '<div class="tip">模型返回了空内容，再试一次</div>';
  let obj=null,err="";
  const cands=[];
  let c=content.trim();
  c=c.replace(/^\s*```(?:json)?/i,"").replace(/```\s*$/,"").trim();
  cands.push(c);
  const i=c.indexOf("{"),j=c.lastIndexOf("}");
  if(i>-1&&j>i)cands.push(c.slice(i,j+1));
  const i2=c.indexOf("{"),j2=c.indexOf("}");
  if(i2>-1&&j2>i2)cands.push(c.slice(i2,j2+1));
  for(const k of cands){
    const tries=[k,k.replace(/,\s*([}\]])/g,"$1")];
    for(const v of tries){
      try{obj=JSON.parse(v);break}catch(e){err=e.message}
    }
    if(obj)break;
  }
  if(!obj){
    return '<div class="tip">AI 返回的不是合法 JSON（可能是输出被截断）。再点一次通常就好了。<br><br><span style="color:var(--r)">'+esc(err)+'</span></div>'
      +'<details style="margin-top:8px"><summary style="font-size:12px;color:var(--ink3)">看原始返回（前 500 字）</summary><div style="font-size:11px;color:var(--ink3);word-break:break-all;margin-top:6px">'+esc(content.slice(0,500))+'</div></details>';
  }
  let arr=obj.recipes||obj.recipe||obj.list||obj.data;
  if(!Array.isArray(arr)){
    for(const k in obj){if(Array.isArray(obj[k])){arr=obj[k];break}}
  }
  if(!Array.isArray(arr))return '<div class="tip">AI 没有给出菜谱数组，换个说法再试</div>';
  const list=arr.filter(r=>r&&r.name&&(r.must||r.ingredients));
  if(!list.length)return '<div class="tip">没有生成有效方案，再点一次</div>';
  aiResults=list.map(r=>({
    name:r.name,time:r.time||20,desc:r.desc||r.description||"",
    must:(r.must||r.ingredients||[]).map(x=>typeof x==="string"?x:(x.name||"")),
    opt:(r.opt||[]).map(x=>typeof x==="string"?x:(x.name||"")),
    steps:(r.steps||[]).map(x=>typeof x==="string"?x:String(x)),
    tip:r.tip||""
  }));
  return aiResults.map((r,i)=>{
    const ok=r.must.filter(n=>BY[n]);
    const bad=r.must.filter(n=>!BY[n]);
    const dup=ALL().some(function(x){return x.n===r.name});
    const mac=rcpMacro({n:r.name,m:ok,o:r.opt||[]});
    return `<div class="rec" style="cursor:default">
      <div class="t"><b>${esc(r.name)}</b><em>${r.time||"?"} 分钟</em></div>
      <div class="d">${esc(r.desc||"")}</div>
      <div class="mac">${macLine(mac)}<span style="color:var(--ink4)"> · 本地库计算</span></div>
      <div class="badges">${dup?'<span class="badge mut">已在食谱库</span>':''}${ok.map(n=>`<span class="badge info">${esc(n)}</span>`).join("")}${bad.map(n=>`<span class="badge warn">库里没有：${esc(n)}</span>`).join("")}</div>
      <ol class="steps">${(r.steps||[]).map(x=>`<li>${esc(x)}</li>`).join("")}</ol>
      ${r.tip?`<div class="tip" style="font-size:12.5px;margin-top:6px">${esc(r.tip)}</div>`:""}
      <div class="btns" style="margin-top:10px">
        <button class="btn" onclick="adoptAI(${i})">采纳入库</button>
        <button class="btn ghost" onclick="this.closest('.rec').remove()">丢弃</button>
      </div></div>`;
  }).join("");
}
function esc(x){return String(x).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")}
function adoptAI(i){
  const r=aiResults[i];if(!r)return;
  const m=r.must.filter(n=>BY[n]);
  if(!m.length){alert("食材名和本地库对不上，无法计算营养。可以让 AI 用完全一致的写法重写。");return}
  S.myRcp=S.myRcp||[];
  if(RCP.some(function(x){return x.n===r.name})){
    alert("「"+r.name+"」是内置食谱，库里已经有，不用重复添加。\n去食谱页搜它就能直接用。");
    return;
  }
  const idx=S.myRcp.findIndex(function(x){return x.n===r.name});
  if(idx>-1){
    if(!confirm("「"+r.name+"」已经在你的食谱库里了。\n\n要用这次的版本覆盖旧步骤吗？"))return;
    S.myRcp.splice(idx,1);
  }
  S.myRcp.push({n:r.name,c:"主",t:r.time||20,d:r.desc||"",m:m,
    o:(r.opt||[]).filter(n=>BY[n]),s:r.steps||[],k:0,tip:r.tip||"",ai:1});
  save();alert("已加入食谱库，可以在食谱页找到，也能参与推荐");closeSheet();setTab("rcp");
}
function dedupeRcp(){
  const base={};RCP.forEach(function(r){base[r.n]=1});
  const seen={};const out=[];
  (S.myRcp||[]).forEach(function(r){
    if(base[r.n]||seen[r.n])return;
    seen[r.n]=1;out.push(r);
  });
  const removed=(S.myRcp||[]).length-out.length;
  S.myRcp=out;save();
  return removed;
}
function dedupeDish(){
  const base={};DISH.forEach(function(x){base[x.n]=1});
  const seen={};const out=[];
  (S.myDish||[]).forEach(function(x){
    if(base[x.n]||seen[x.n])return;
    seen[x.n]=1;out.push(x);
  });
  const removed=(S.myDish||[]).length-out.length;
  S.myDish=out;save();
  return removed;
}
function delMyDish(i){
  if(!confirm("删除这道自定义菜品？"))return;
  S.myDish.splice(i,1);save();render();
}
function doDedupe(){
  const r=dedupeRcp(),d=dedupeDish();
  const msg=[];
  if(r>0)msg.push("食谱 "+r+" 条");
  if(d>0)msg.push("菜品 "+d+" 条");
  alert(msg.length?("已清理 "+msg.join("、")):"没有发现重复");
  render();
}
/* ============ 买菜清单 ============ */
function shopGap(){
  const one={},two={};
  ALL().forEach(function(r){
    const miss=(r.m||[]).filter(function(n){return BY[n]&&!haveIng(n)});
    if(miss.length===1)one[miss[0]]=(one[miss[0]]||0)+1;   /* 只差这一样：买它就能多做几道 */
    else if(miss.length===2)miss.forEach(function(n){two[n]=(two[n]||0)+1});
  });
  /* 优先列"只差一样"的；一道都没有时退一步，列还差两样的 */
  const src=Object.keys(one).length?one:two,map={};
  Object.keys(src).forEach(function(n){map[n]={g:BY[n].ug||100,unlock:src[n]}});
  return map;
}
function fillShop(){
  const gap=shopGap();
  S.shop=S.shop||[];
  const byName={};
  S.shop.forEach(function(x){byName[x.n]=x});
  let add=0;
  Object.keys(gap).forEach(function(n){
    const g=gap[n];
    if(byName[n]){byName[n].g=Math.max(byName[n].g,g.g);byName[n].unlock=g.unlock;return}
    S.shop.push({n:n,g:g.g,unlock:g.unlock,done:false});add++;
  });
  save();openShop();
  if(!add&&!S.shop.length)alert("暂时没有要补的：要么库存很全，要么缺的东西超过 2 样（先把缺得多的菜做掉）");
}
function toggleShop(i){
  const it=(S.shop||[])[i];if(!it)return;
  it.done=!it.done;save();openShop();
}
function delShop(i){
  S.shop=(S.shop||[]).filter(function(_,k){return k!==i});
  save();openShop();
}
function openShop(){
  sheetRedraw=1;
  const s=S.shop||[];
  let h='<h3>买菜清单</h3><div class="sm">从「还差 1–2 样」的菜里汇总，买到的勾上再一键入库</div>';
  h+='<button class="btn ghost" onclick="fillShop()">＋ 从库存缺口补全</button>';
  if(!s.length){
    h+='<div class="empty">清单是空的<br>点上面的按钮，按你缺的食材自动列出来</div>';
  }else{
    h+='<div style="margin-top:12px">';
    s.forEach(function(it,i){
      h+='<div class="opt'+(it.done?' on':'')+'" onclick="toggleShop('+i+')">'
        +'<span class="on1">'+(it.done?'✓ ':'')+esc(it.n)
        +'<br><span style="font-size:11.5px;color:var(--ink3)">约 '+Math.round(it.g)+'g'
        +(it.unlock?' · 买了能做 '+it.unlock+' 道':'')+'</span></span>'
        +'<span class="add" style="padding:1px 8px" onclick="event.stopPropagation();delShop('+i+')">删</span></div>';
    });
    h+='</div>';
    const n=s.filter(function(x){return x.done}).length;
    h+='<div style="height:12px"></div><button class="btn" onclick="buyShop()">'+(n?("把勾选的 "+n+" 样加入库存"):"先勾选买到的食材")+'</button>';
  }
  h+='<div style="height:8px"></div><button class="btn ghost" onclick="closeSheet()">关闭</button>';
  openSheet(h);
}
function buyShop(){
  const sel=(S.shop||[]).filter(function(x){return x.done});
  if(!sel.length){alert("先勾选买到的食材");return}
  let ok=0;
  sel.forEach(function(it){
    const f=BY[it.n];if(!f)return;
    S.inv.push({id:f.id,n:f.n,g:Math.round(it.g*10)/10,d:today()});
    ok++;
  });
  S.shop=(S.shop||[]).filter(function(x){return !x.done});
  save();closeSheet();render();
  notice("已入库 "+ok+" 样");
}
function openWaste(){
  sheetRedraw=1;
  const w=(S.waste||[]).slice().sort(function(a,b){return b.d.localeCompare(a.d)});
  let h='<h3>浪费记录</h3><div class="sm">扔掉的食材，不计入摄入</div>';
  if(!w.length){
    h+='<div class="empty">还没有浪费记录<br>库存里点「扔掉这一份」才会记在这里</div>';
  }else{
    let tg=0,tk=0;
    h+='<div style="max-height:54vh;overflow-y:auto">';
    w.forEach(function(x){
      const f=foodOf(x);if(!f)return;
      const k=f.kcal*x.g/100;tg+=x.g;tk+=k;
      h+='<div class="logitem"><span>'+esc(f.n)+'</span><span class="r">'+Math.round(x.g)+'g · '+Math.round(k)+' kcal<br><span style="color:var(--ink4)">'+x.d.slice(5)+'</span></span></div>';
    });
    h+='</div><div class="preview"><div class="l"><b>合计</b><b>'+w.length+' 次</b></div>'
      +'<div class="l"><span>约 '+Math.round(tg)+'g ｜ 折合 '+Math.round(tk)+' kcal</span></div></div>';
  }
  h+='<button class="btn ghost" onclick="closeSheet()">关闭</button>';
  openSheet(h);
}
function exportData(){
  /* 备份里不带 API Key：这个文件很容易被发到微信 / 网盘 */
  const copy=JSON.parse(JSON.stringify(S));
  if(copy.ai)delete copy.ai.key;
  const json=JSON.stringify(copy,null,2);
  const name="寝室餐食备份-"+today()+".json";
  const tip="（不含 AI Key，换机后到「设置 → AI」重填即可）";
  if(window.AndroidBridge&&window.AndroidBridge.save){
    const r=window.AndroidBridge.save(name,json);
    if(String(r).indexOf("ok:")===0)alert("已存到手机：\n"+String(r).slice(3)+"\n\n可以用文件管理器找到，也能直接发到微信或网盘。\n"+tip);
    else alert("保存失败："+r);
    return;
  }
  const blob=new Blob([json],{type:"application/json"});
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);a.download=name;a.click();
  setTimeout(function(){alert("已导出 "+name+"\n"+tip)},120);
}
function importData(){
  /* 安卓壳走原生取文件，网页版走 file input —— 之前网页版根本无法恢复 */
  if(window.AndroidBridge&&window.AndroidBridge.load){
    const t=window.AndroidBridge.load();
    if(!t||String(t).indexOf("err:")===0){alert("没有找到备份文件，先点「导出备份」生成一个。");return}
    applyImport(t);
    return;
  }
  const inp=document.createElement("input");
  inp.type="file";inp.accept=".json,application/json";inp.style.display="none";
  document.body.appendChild(inp);
  inp.onchange=function(){
    const f=inp.files&&inp.files[0];
    if(!f){inp.remove();return}
    const fr=new FileReader();
    fr.onload=function(){inp.remove();applyImport(String(fr.result||""))};
    fr.onerror=function(){inp.remove();alert("这个文件读不了")};
    fr.readAsText(f);
  };
  inp.click();
}
function applyImport(t){
  let d;
  try{d=JSON.parse(t)}catch(e){alert("备份文件格式不对");return}
  if(!d||!Array.isArray(d.inv)||!Array.isArray(d.logs)){alert("备份文件格式不对（缺少 inv / logs）");return}
  if(!confirm("用这份备份覆盖当前数据？\n\n当前 "+S.inv.length+" 条库存、"+S.logs.length+" 条记录，会先在本机留一份（"+K+".prev）。"))return;
  try{localStorage.setItem(K+".prev",JSON.stringify(S))}catch(e){}
  S=mergeState(d);
  rebuildFoods();calcTargets();save();render();
  const noKey=!(S.ai&&S.ai.key);
  alert("已恢复："+S.inv.length+" 条库存、"+S.logs.length+" 条记录。\n覆盖前那份数据已留在本机。"
    +(noKey?"\n\n备份里不含 AI Key，去「设置 → AI 写菜谱」重填一下。":""));
}
function clearAll(){
  if(!confirm("清空所有库存与记录？不可恢复。"))return;
  S={inv:[],logs:[],waste:[],myRcp:[],myDish:[],myFood:[],ai:S.ai,set:S.set,w:S.w};rebuildFoods();save();render();
}

calcTargets();save();render();

/* Service Worker：注册时带上版本号，改了 APP_VER 就会触发更新检查 */
(function(){
  if(!("serviceWorker" in navigator))return;
  let hadController=!!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange",function(){
    if(!hadController){hadController=true;return}   /* 首次安装不打扰 */
    notice("新版本已就绪",{sticky:true,action:"刷新",onAction:function(){location.reload()}});
  });
  navigator.serviceWorker.register("sw.js?v="+APP_VER).catch(function(){});
})();
loadWeather(false);
/* ===== 版本检查（v3.9 重做：多来源 + 失败可见） =====
   APK 的页面打包在 assets 里、没有 Service Worker，只能主动去线上要版本号。
   但 Pages 未必在每台手机的网络上都能到，所以依次试 Pages 的 version.json → GitHub API；
   失败也把原因写进 S.upd，设置页「检查更新」能看到具体错误，不再静默失败。 */
const UPD_REPO="pany83025-commits/dorm-meal-assistant";
const UPD_APK="https://github.com/"+UPD_REPO+"/releases/latest/download/dorm-meal.apk";
const UPD_SITE="https://pany83025-commits.github.io/dorm-meal-assistant/";
const UPD_IS_APP=!!(window.AndroidBridge&&window.AndroidBridge.httpGet);
const UPD_BASE=UPD_IS_APP?UPD_SITE:location.href.replace(/[?#].*$/,"").replace(/[^/]*$/,"");
const UPD_EVERY=3600e3;                    /* 自动检查间隔：1 小时 */

function verNum(v){return String(v||"").split(".").map(function(x){return parseInt(x,10)||0})}
function verNewer(a,b){                      /* a 比 b 新返回 true */
  const A=verNum(a),B=verNum(b);
  for(let i=0;i<Math.max(A.length,B.length);i++){
    const x=A[i]||0,y=B[i]||0;
    if(x!==y)return x>y;
  }
  return false;
}
function fetchText(url){
  if(UPD_IS_APP){
    let t;
    try{t=window.AndroidBridge.httpGet(url)}catch(e){throw new Error("桥接调用失败："+((e&&e.message)||e))}
    const str=String(t==null?"":t);
    if(str.indexOf("err:")===0)throw new Error(str.slice(4)||"没取到内容");
    if(!str)throw new Error("返回为空");
    return Promise.resolve(str);
  }
  return fetch(url,{cache:"no-store"}).then(function(r){
    if(!r.ok)throw new Error("HTTP "+r.status);
    return r.text();
  });
}
/* 依次尝试的来源：Pages 的版本文件，APK 再多一个 GitHub API 兜底 */
function updSources(){
  const list=[{name:"Pages",url:UPD_BASE+"version.json",pick:function(t){return JSON.parse(t)}}];
  if(UPD_IS_APP)list.push({
    name:"GitHub API",
    url:"https://api.github.com/repos/"+UPD_REPO+"/releases/latest",
    pick:function(t){
      const d=JSON.parse(t);
      return {version:String(d.tag_name||"").replace(/^v/,""),note:d.name||""};
    }
  });
  return list;
}
function updSave(patch){
  S.upd=Object.assign({at:0,latest:"",note:"",src:"",newer:false,err:""},S.upd||{},patch);
  save();
}
function checkUpdate(force){
  const last=+(S.lastUpd||0);
  if(!force&&Date.now()-last<UPD_EVERY)return Promise.resolve({skipped:true});
  const srcs=updSources(),errs=[];
  function next(i){
    if(i>=srcs.length){
      updSave({at:Date.now(),err:errs.join("；")||"取不到版本信息"});
      return {ok:false,err:S.upd.err};
    }
    const src=srcs[i];
    return Promise.resolve().then(function(){return fetchText(src.url)}).then(function(txt){
      const d=src.pick(txt)||{};
      const v=String(d.version||"").trim();
      if(!v)throw new Error("返回里没有版本号");
      const newer=verNewer(v,APP_VER);
      S.lastUpd=Date.now();
      updSave({at:Date.now(),latest:v,note:d.note||"",src:src.name,newer:newer,err:""});
      if(newer)showUpdateNotice(v,d.note||"",d.apk||UPD_APK);
      return {ok:true,version:v,newer:newer,src:src.name};
    }).catch(function(e){
      errs.push(src.name+"："+((e&&e.message)||"失败"));
      return next(i+1);
    });
  }
  return Promise.resolve().then(function(){return next(0)});
}
function updOpen(url){
  const u=url||UPD_APK;
  if(window.AndroidBridge&&window.AndroidBridge.openUrl){window.AndroidBridge.openUrl(u);return}
  window.open(u,"_blank");
}
function showUpdateNotice(v,note,apk){
  notice("有新版本 v"+v+(note?"："+note:""),{
    sticky:true,action:"去更新",
    onAction:function(){hideNotice();updOpen(apk)}
  });
}
function updTime(t){
  if(!t)return "还没查过";
  const d=new Date(t),pad=function(x){return (x<10?"0":"")+x};
  return (d.getMonth()+1)+"-"+pad(d.getDate())+" "+pad(d.getHours())+":"+pad(d.getMinutes());
}
function openSetUpdate(){
  sheetRedraw=1;
  const u=S.upd||{},err=u.err||"";
  let h='<h3>检查更新</h3><div class="sm">当前 v'+APP_VER+' ｜ 上次检查 '+updTime(u.at)+'</div>';
  h+='<div class="logitem"><span>当前版本</span><span class="r">v'+APP_VER+'</span></div>';
  h+='<div class="logitem"><span>线上版本</span><span class="r">'
    +(u.latest?("v"+u.latest+(u.newer?"（有新版）":"（已是最新）")):"—")+'</span></div>';
  if(u.src)h+='<div class="logitem"><span>数据来源</span><span class="r">'+esc(u.src)+'</span></div>';
  if(err){
    h+='<div class="tip warn" style="margin-top:12px">检查失败：'+esc(err)
      +'<br><span style="font-size:11.5px">可能是当前网络到不了 GitHub。可换 Wi-Fi / 开代理再试，'
      +'或直接点下面「去下载页」。</span></div>';
  }else if(u.latest&&!u.newer){
    h+='<div class="tip ok" style="margin-top:12px">已经是最新版本</div>';
  }
  h+='<div style="height:12px"></div><button class="btn" id="updBtn" onclick="manualCheckUpdate()">立即检查</button>';
  h+='<div style="height:8px"></div><button class="btn ghost" onclick="updOpen()">去下载页（GitHub）</button>';
  h+='<div style="height:8px"></div><button class="btn ghost" onclick="closeSheet()">关闭</button>';
  openSheet(h);
}
function manualCheckUpdate(){
  const b=$("updBtn");
  if(b){b.disabled=true;b.textContent="检查中…"}
  checkUpdate(true).then(function(r){
    sheetRedraw=1;openSetUpdate();
    if(r&&r.ok&&!r.newer)notice("已是最新版本 v"+APP_VER);
  },function(){
    sheetRedraw=1;openSetUpdate();
  });
}
/* 从后台切回来 / 重新可见时复查：APK 的 WebView 不会重新加载，靠这两个钩子 */
window.__onResume=function(){setTimeout(function(){checkUpdate(false)},500)};
document.addEventListener("visibilitychange",function(){
  if(!document.hidden)setTimeout(function(){checkUpdate(false)},500);
});
setTimeout(function(){checkUpdate(false)},2200);   /* 等开屏动画退场再查，免得提示被盖住 */



(function(){
  var el=document.getElementById("splash");
  if(!el)return;
  var seen=null;
  try{seen=sessionStorage.getItem("booted")}catch(e){}
  if(seen){ if(el.parentNode)el.parentNode.removeChild(el); return; }
  try{sessionStorage.setItem("booted","1")}catch(e){}
  setTimeout(function(){
    el.classList.add("out");
    setTimeout(function(){ if(el.parentNode)el.parentNode.removeChild(el); },440);
  },1760);
})();

/* 键盘避让：把系统给出的 IME 高度换算成页面需要让出的空间 */
window.__baseH=window.innerHeight;
window.__imeDp=0;
window.__setIme=function(dp){
  window.__imeDp=dp||0;
  applyKB();
};
function applyKB(){
  const sh=Math.max(0,(window.__baseH||window.innerHeight)-window.innerHeight);
  const kb=Math.max(0,(window.__imeDp||0)-sh);
  document.documentElement.style.setProperty("--kb",kb+"px");
}
window.addEventListener("resize",function(){
  if(!window.__imeDp)window.__baseH=window.innerHeight;
  applyKB();
});
window.addEventListener("scroll",function(){
  const hd=document.getElementById("hd");
  if(hd)hd.classList.toggle("scrolled",window.scrollY>4);
},{passive:true});
document.addEventListener("focusin",function(e){
  const t=e.target;
  if(!t||!/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))return;
  setTimeout(function(){
    try{t.scrollIntoView({block:"center",behavior:"smooth"})}catch(_){}
  },300);
});

/* 返回键：有弹层先关弹层，没有才让系统退出 */
window.__onBack=function(){
  const sh=document.getElementById("sheet");
  if(sh&&sh.classList.contains("on")){sheetBack();return true}     /* 只退一层 */
  const pg=document.getElementById("page");
  if(pg&&pg.classList.contains("on")){closePage();return true}      /* 整页子视图先关掉，不能直接退 App */
  if(typeof tab!=="undefined"&&tab==="set"){setTab("log");return true}
  if(typeof tab!=="undefined"&&tab!=="today"){setTab("today");return true}
  return false;
};

/* 弹层手势：只保留「向右滑＝退一层」。
   下拉关闭已经去掉——短弹层里内下滑太容易误触，退出请用右上角 × 或返回键。 */
(function(){
  const sh=document.getElementById("sheet");
  if(!sh)return;
  let sx=0,sy=0,t0=0,dir="",box=null,lastX=0,lastY=0;
  sh.addEventListener("touchstart",function(e){
    if(e.touches.length!==1){box=null;return}
    box=sh.querySelector(".box");
    if(box){box.style.transition="none";box.style.animation=""}
    sx=e.touches[0].clientX;sy=e.touches[0].clientY;
    lastX=sx;lastY=sy;t0=Date.now();dir="";
  },{passive:true});
  sh.addEventListener("touchmove",function(e){
    if(!box||e.touches.length!==1)return;
    const dx=e.touches[0].clientX-sx,dy=e.touches[0].clientY-sy;
    lastX=e.touches[0].clientX;lastY=e.touches[0].clientY;
    if(!dir){
      /* 只认横向意图；纵向一律交给弹层自己滚动 */
      if(dx>14&&Math.abs(dx)>Math.abs(dy)*1.1)dir="right";
      else if(Math.abs(dx)>10||Math.abs(dy)>10)dir="none";
    }
    if(dir==="right"&&dx>0){
      box.style.transform="translateX("+dx+"px)";
      if(e.cancelable)e.preventDefault();
    }
  },{passive:false});
  function rebound(){
    if(!box)return;
    box.style.transition="transform .3s cubic-bezier(.22,1,.36,1)";
    box.style.transform="";
    const b=box;
    setTimeout(function(){if(b)b.style.transition=""},320);
  }
  sh.addEventListener("touchend",function(e){
    if(!box)return;
    const t=e.changedTouches?e.changedTouches[0]:{clientX:lastX,clientY:lastY};
    const dx=t.clientX-sx,dy=t.clientY-sy,dt=Math.max(1,Date.now()-t0);
    const vx=dx/dt;
    if(dir==="right"&&(dx>110||(dx>70&&vx>0.5))){box.style.transform="";sheetBack();}
    else rebound();
    dir="";box=null;
  },{passive:true});
  sh.addEventListener("touchcancel",function(){rebound();dir="";box=null},{passive:true});
})();
