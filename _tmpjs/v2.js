(function(){
  var st=document.createElement("style");
  st.textContent="#page,#pageIn,#sheet,#sheetBox,.sheetIn{animation:none!important;transition:none!important}";
  document.head.appendChild(st);
  var y=dayAdd(today(),-1);
  S.logs.push({d:y,m:"晚",name:"食堂 · 番茄炒蛋盖饭",kcal:520,p:18,f:16,c:70,na:900,veg:80});
  openDay(y);
  setTimeout(function(){openLogFor(y);fitPager()},400);
})();
