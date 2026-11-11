import fs from "node:fs";
const html=fs.readFileSync("index.html","utf8");
["v1","v2","v3","v4"].forEach(function(n){
  const body=fs.readFileSync("_tmpjs/"+n+".js","utf8");
  fs.writeFileSync("_tmpjs/"+n+".html", html.replace("</body>","<script>setTimeout(function(){\n"+body+"\n},250);</script>\n</body>"));
});
console.log("ok");
