(function(){
  var st=document.createElement("style");
  st.textContent="#page,#pageIn,#sheet,#sheetBox,.sheetIn{animation:none!important;transition:none!important}";
  document.head.appendChild(st);
  var y=dayAdd(today(),-1);
  openDay(y);
  setTimeout(function(){openLogFor(y)},300);
  setTimeout(function(){document.querySelector(".sheetIn span[onclick]").click()},600);
})();
