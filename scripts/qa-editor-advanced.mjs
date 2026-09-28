import { chromium } from "playwright-core";
const browser=await chromium.launch({headless:true,executablePath:"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",args:["--use-angle=swiftshader"]});
const page=await browser.newPage({viewport:{width:1500,height:980}});
const errors=[];
page.on("pageerror",e=>errors.push("page: "+e.message));
page.on("console",m=>{if(m.type()==="error")errors.push("console: "+m.text())});
await page.goto("http://127.0.0.1:5173/?editor=1",{waitUntil:"domcontentloaded"});
await page.waitForFunction(()=>document.body.classList.contains("nova-persistent-3d-ready"),null,{timeout:15000});
await page.getByRole("button",{name:"Expand"}).click();
await page.waitForFunction(()=>{
  const input=document.querySelector(".sse-fields input");
  return input && Number.isFinite(Number(input.value));
},null,{timeout:10000});

const initial=await page.evaluate(()=>({
 heroDuration:Number(document.querySelector(".sse-section-panel input[type=number]").value),
 productDots:document.querySelectorAll(".sse-keyframe").length
}));

await page.getByRole("button",{name:"Camera",exact:true}).click();
await page.waitForTimeout(100);
const camBefore=await page.locator(".sse-fields--camera input").evaluateAll(els=>els.map(e=>e.value));
const fov=page.locator(".sse-fields--camera input").nth(6);
await fov.fill("42");
await fov.press("Enter");
await page.locator("[data-sse-save-keyframe]").click();
await page.waitForTimeout(100);
const cameraDots=await page.locator(".sse-keyframe").count();

await page.getByRole("button",{name:"Product",exact:true}).click();
await page.keyboard.down("p");
await page.evaluate(()=>window.scrollTo(0,Math.min(500,document.documentElement.scrollHeight-window.innerHeight)));
await page.waitForTimeout(100);
await page.keyboard.up("p");
await page.waitForTimeout(100);

const pinDuration=Number(await page.locator(".sse-section-panel input[type=number]").inputValue());

await page.getByRole("button",{name:"Undo"}).click();
await page.waitForTimeout(100);
await page.getByRole("button",{name:"Undo"}).click();
await page.waitForTimeout(100);

const afterUndo=await page.evaluate(()=>({
 heroDuration:Number(document.querySelector(".sse-section-panel input[type=number]").value),
 productDots:document.querySelectorAll(".sse-keyframe").length
}));

console.log(JSON.stringify({initial,camBefore,cameraDots,pinDuration,afterUndo,errors},null,2));
await browser.close();