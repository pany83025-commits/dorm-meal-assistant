(function(){
  var P=[];
  var st=document.createElement("style");
  st.textContent="#page,#pageIn,#sheet,#sheetBox,.sheetIn{animation:none!important;transition:none!important}";
  document.head.appendChild(st);
  try{
    var y=dayAdd(today(),-1);
    openDay(y);
    var ph=document.querySelector(".phead");
    P.push(["inner",window.innerWidth]);
    P.push(["phRect",JSON.stringify(ph.getBoundingClientRect())]);
    [].slice.call(ph.children).forEach(function(c,i){
      var r=c.getBoundingClientRect();
      P.push(["child"+i,c.className||c.tagName,Math.round(r.x),Math.round(r.width)]);
    });
  }catch(e){P.push(["EX",e.message])}
  document.title="PROBE::"+JSON.stringify(P);
})();
