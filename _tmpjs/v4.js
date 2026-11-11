(function(){
  var st=document.createElement("style");
  st.textContent="#page,#pageIn,#sheet,#sheetBox,.sheetIn{animation:none!important;transition:none!important}";
  document.head.appendChild(st);
  openDay(dayAdd(today(),-3));
})();
