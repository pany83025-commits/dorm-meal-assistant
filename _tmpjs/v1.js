(function(){
  var st=document.createElement("style");
  st.textContent="#page,#pageIn,#sheet,#sheetBox,.sheetIn{animation:none!important;transition:none!important}";
  document.head.appendChild(st);
  var y=dayAdd(today(),-1);
  S.logs.push({d:y,m:"晚",name:"食堂 · 番茄炒蛋盖饭",kcal:520,p:18,f:16,c:70,na:900,veg:80,fib:4,ca:120,fe:2.1,vc:18});
  S.logs.push({d:y,m:"午",name:"肉蟹煲 + 米饭",kcal:880,p:42,f:48,c:76,na:2100,veg:120,fib:3,ca:90,fe:3.2,vc:12});
  openDay(y);
  fitPager();
})();
