#!/usr/bin/env node
/** Actual exported cast, same light/camera/scale, front/side/walking/grayscale views. */
import fs from 'node:fs/promises'
import { chromium } from 'playwright'
const base=process.env.RAFFI_WORLD_URL||'http://127.0.0.1:3081'
const out=process.env.RAFFI_POPULATION_OUT||'/tmp/raffi-population-lineup'
await fs.mkdir(out,{recursive:true})
const browser=await chromium.launch({headless:true,args:['--use-angle=metal']})
try {
 const page=await browser.newPage({viewport:{width:1440,height:1350}}),errors=[]
 page.on('pageerror',error=>errors.push(error.message))
 await page.route('**/__population-lineup',route=>route.fulfill({contentType:'text/html',body:`<meta charset="utf-8"><style>body{margin:0;background:#969d9d}#labels{position:absolute;inset:0;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(3,1fr);pointer-events:none}#labels>div{padding:12px 16px;font:15px system-ui;color:#20292c;align-content:end}</style><div id="labels"></div><script type="importmap">{"imports":{"three":"/world/vendor/three.module.js"}}</script><script type="module">
import*as T from'three';import{loadPopulation,loadPopulationTemplate}from'/world/engine/population.js';import{clone}from'/world/vendor/utils/SkeletonUtils.js';
const catalog=await loadPopulation();const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1440,1350);renderer.setPixelRatio(1);renderer.setScissorTest(true);renderer.toneMapping=T.ACESFilmicToneMapping;document.body.prepend(renderer.domElement);const camera=new T.PerspectiveCamera(32,360/450,.1,30);camera.position.set(0,1.0,3.75);camera.lookAt(0,.88,0);window.items=[];
for(const identity of catalog.identities){const template=await loadPopulationTemplate(identity.id,'near'),model=clone(template.scene),scene=new T.Scene();scene.background=new T.Color('#969d9d');scene.add(model);model.traverse(o=>{if(o.isMesh)o.frustumCulled=false});scene.add(new T.HemisphereLight('#f6faff','#6f665b',2));const light=new T.DirectionalLight('#fff2de',2.6);light.position.set(3,5,4);scene.add(light);const mixer=new T.AnimationMixer(model);const label=document.createElement('div');label.textContent=identity.label+' · '+identity.age+' · '+identity.height.toFixed(2)+' m';document.querySelector('#labels').append(label);items.push({scene,model,mixer,animations:template.animations})}
window.pose=(animation='idle',angle=0,time=.5)=>{items.forEach(item=>{item.mixer.stopAllAction();item.model.rotation.y=angle;item.mixer.clipAction(item.animations.find(clip=>clip.name===animation)).reset().play();item.mixer.update(time)});draw()};window.draw=()=>items.forEach((item,index)=>{const x=index%4*360,y=(2-Math.floor(index/4))*450;renderer.setViewport(x,y,360,450);renderer.setScissor(x,y,360,450);renderer.render(item.scene,camera)});pose();window.ready=true;</script>`}))
 await page.goto(base+'/__population-lineup');await page.waitForFunction(()=>window.ready,null,{timeout:90000})
 await page.screenshot({path:out+'/front.png'})
 await page.evaluate(()=>pose('idle',Math.PI/2));await page.screenshot({path:out+'/side.png'})
 await page.evaluate(()=>pose('walk',0,.45));await page.screenshot({path:out+'/walking.png'})
 await page.evaluate(()=>{pose();document.querySelector('canvas').style.filter='grayscale(1)'})
 await page.screenshot({path:out+'/grayscale.png'})
 await fs.writeFile(out+'/report.json',JSON.stringify({errors,identities:await page.evaluate(()=>items.map(item=>({name:item.model.children[0]?.name,clips:item.animations.map(c=>c.name)})))},null,2))
 if(errors.length)throw new Error(errors.join('\n'))
 process.stdout.write(out+'\n')
}finally{await browser.close()}
