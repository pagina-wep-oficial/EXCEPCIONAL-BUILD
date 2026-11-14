(() => {
  let engine;
  const groups=[
  {
    "id": "header",
    "selector": ".topbar",
    "config": {
      "enabled": true,
      "entry": "pop",
      "exit": "zoom",
      "hover": "none",
      "press": "none",
      "duration": 420,
      "delay": 0,
      "distance": 12,
      "direction": "up",
      "easing": "soft",
      "stagger": 30,
      "repeat": false
    }
  },
  {
    "id": "navigation",
    "selector": ".app-nav",
    "config": {
      "enabled": true,
      "entry": "pop",
      "exit": "zoom",
      "hover": "none",
      "press": "none",
      "duration": 420,
      "delay": 0,
      "distance": 12,
      "direction": "up",
      "easing": "soft",
      "stagger": 30,
      "repeat": false
    }
  },
  {
    "id": "cards",
    "selector": ".product-card",
    "config": {
      "enabled": true,
      "entry": "pop",
      "exit": "zoom",
      "hover": "grow",
      "press": "none",
      "duration": 420,
      "delay": 0,
      "distance": 12,
      "direction": "up",
      "easing": "soft",
      "stagger": 30,
      "repeat": false
    }
  },
  {
    "id": "filters",
    "selector": ".catalog-tools",
    "config": {
      "enabled": true,
      "entry": "pop",
      "exit": "zoom",
      "hover": "none",
      "press": "none",
      "duration": 420,
      "delay": 0,
      "distance": 12,
      "direction": "up",
      "easing": "soft",
      "stagger": 30,
      "repeat": false
    }
  },
  {
    "id": "primary",
    "selector": ".button.primary",
    "config": {
      "enabled": true,
      "entry": "none",
      "exit": "none",
      "hover": "grow",
      "press": "soft",
      "duration": 420,
      "delay": 0,
      "distance": 12,
      "direction": "up",
      "easing": "soft",
      "stagger": 0,
      "repeat": false
    }
  },
  {
    "id": "secondary",
    "selector": ".button.secondary",
    "config": {
      "enabled": true,
      "entry": "none",
      "exit": "none",
      "hover": "grow",
      "press": "soft",
      "duration": 420,
      "delay": 0,
      "distance": 12,
      "direction": "up",
      "easing": "soft",
      "stagger": 0,
      "repeat": false
    }
  },
  {
    "id": "cart",
    "selector": ".cart-item",
    "config": {
      "enabled": true,
      "entry": "pop",
      "exit": "zoom",
      "hover": "grow",
      "press": "none",
      "duration": 420,
      "delay": 0,
      "distance": 12,
      "direction": "up",
      "easing": "soft",
      "stagger": 30,
      "repeat": false
    }
  },
  {
    "id": "checkout",
    "selector": ".checkout-panel",
    "config": {
      "enabled": true,
      "entry": "pop",
      "exit": "zoom",
      "hover": "none",
      "press": "none",
      "duration": 420,
      "delay": 0,
      "distance": 12,
      "direction": "up",
      "easing": "soft",
      "stagger": 30,
      "repeat": false
    }
  },
  {
    "id": "orders",
    "selector": ".current-order-card,.history-card",
    "config": {
      "enabled": true,
      "entry": "pop",
      "exit": "zoom",
      "hover": "none",
      "press": "none",
      "duration": 420,
      "delay": 0,
      "distance": 12,
      "direction": "up",
      "easing": "soft",
      "stagger": 30,
      "repeat": false
    }
  },
  {
    "id": "detail",
    "selector": ".detail-copy",
    "config": {
      "enabled": true,
      "entry": "pop",
      "exit": "zoom",
      "hover": "none",
      "press": "none",
      "duration": 420,
      "delay": 0,
      "distance": 12,
      "direction": "up",
      "easing": "soft",
      "stagger": 30,
      "repeat": false
    }
  },
  {
    "id": "detailMedia",
    "selector": ".detail-media",
    "config": {
      "enabled": true,
      "entry": "pop",
      "exit": "zoom",
      "hover": "none",
      "press": "none",
      "duration": 420,
      "delay": 0,
      "distance": 12,
      "direction": "up",
      "easing": "soft",
      "stagger": 30,
      "repeat": false
    }
  },
  {
    "id": "detailAdd",
    "selector": ".detail-actions [data-add]",
    "config": {
      "enabled": true,
      "entry": "none",
      "exit": "none",
      "hover": "grow",
      "press": "soft",
      "duration": 420,
      "delay": 0,
      "distance": 12,
      "direction": "up",
      "easing": "soft",
      "stagger": 0,
      "repeat": false
    }
  },
  {
    "id": "detailCart",
    "selector": ".detail-actions a[href*='carrito']",
    "config": {
      "enabled": true,
      "entry": "none",
      "exit": "none",
      "hover": "grow",
      "press": "soft",
      "duration": 420,
      "delay": 0,
      "distance": 12,
      "direction": "up",
      "easing": "soft",
      "stagger": 0,
      "repeat": false
    }
  },
  {
    "id": "detailOffer",
    "selector": ".external-offer-cta",
    "config": {
      "enabled": true,
      "entry": "none",
      "exit": "none",
      "hover": "grow",
      "press": "soft",
      "duration": 420,
      "delay": 0,
      "distance": 12,
      "direction": "up",
      "easing": "soft",
      "stagger": 0,
      "repeat": false
    }
  },
  {
    "id": "cardMedia",
    "selector": ".product-card [data-product-field=\"media\"]",
    "config": {
      "enabled": true,
      "entry": "none",
      "exit": "none",
      "hover": "none",
      "press": "none",
      "duration": 420,
      "delay": 0,
      "distance": 12,
      "direction": "up",
      "easing": "soft",
      "stagger": 0,
      "repeat": false
    }
  },
  {
    "id": "cardName",
    "selector": ".product-card [data-product-field=\"name\"]",
    "config": {
      "enabled": true,
      "entry": "none",
      "exit": "none",
      "hover": "none",
      "press": "none",
      "duration": 420,
      "delay": 0,
      "distance": 12,
      "direction": "up",
      "easing": "soft",
      "stagger": 0,
      "repeat": false
    }
  },
  {
    "id": "cardDescription",
    "selector": ".product-card [data-product-field=\"description\"]",
    "config": {
      "enabled": true,
      "entry": "none",
      "exit": "none",
      "hover": "none",
      "press": "none",
      "duration": 420,
      "delay": 0,
      "distance": 12,
      "direction": "up",
      "easing": "soft",
      "stagger": 0,
      "repeat": false
    }
  },
  {
    "id": "cardPrice",
    "selector": ".product-card [data-product-field=\"price\"]",
    "config": {
      "enabled": true,
      "entry": "none",
      "exit": "none",
      "hover": "none",
      "press": "none",
      "duration": 420,
      "delay": 0,
      "distance": 12,
      "direction": "up",
      "easing": "soft",
      "stagger": 0,
      "repeat": false
    }
  },
  {
    "id": "cardAdd",
    "selector": ".product-card [data-add]",
    "config": {
      "enabled": true,
      "entry": "none",
      "exit": "none",
      "hover": "grow",
      "press": "soft",
      "duration": 420,
      "delay": 0,
      "distance": 12,
      "direction": "up",
      "easing": "soft",
      "stagger": 0,
      "repeat": false
    }
  },
  {
    "id": "cardView",
    "selector": ".product-card [data-product-detail-link]",
    "config": {
      "enabled": true,
      "entry": "none",
      "exit": "none",
      "hover": "grow",
      "press": "soft",
      "duration": 420,
      "delay": 0,
      "distance": 12,
      "direction": "up",
      "easing": "soft",
      "stagger": 0,
      "repeat": false
    }
  },
  {
    "id": "detailName",
    "selector": ".detail-copy h1",
    "config": {
      "enabled": true,
      "entry": "none",
      "exit": "none",
      "hover": "none",
      "press": "none",
      "duration": 420,
      "delay": 0,
      "distance": 12,
      "direction": "up",
      "easing": "soft",
      "stagger": 0,
      "repeat": false
    }
  },
  {
    "id": "detailPrice",
    "selector": ".detail-copy .price",
    "config": {
      "enabled": true,
      "entry": "none",
      "exit": "none",
      "hover": "none",
      "press": "none",
      "duration": 420,
      "delay": 0,
      "distance": 12,
      "direction": "up",
      "easing": "soft",
      "stagger": 0,
      "repeat": false
    }
  },
  {
    "id": "detailBack",
    "selector": ".back-link",
    "config": {
      "enabled": true,
      "entry": "none",
      "exit": "none",
      "hover": "grow",
      "press": "soft",
      "duration": 420,
      "delay": 0,
      "distance": 12,
      "direction": "up",
      "easing": "soft",
      "stagger": 0,
      "repeat": false
    }
  }
];
  const configuration=value=>value;
  const timings={smooth:"cubic-bezier(.2,.7,.2,1)",soft:"cubic-bezier(.2,.8,.2,1.15)",quick:"cubic-bezier(.2,.8,.4,1)",linear:"linear",steps:"steps(3,end)"};
  function start(provider) {
    if (engine) return engine;
    const records = new Map();
    const seen = new Set();
    const ghosts = new Map();
    const preference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const frame = callback => window.requestAnimationFrame ? window.requestAnimationFrame(callback) : window.setTimeout(callback,0);
    let scheduled = false;
    let previousTheme = document.body.dataset.storeDesign;
    let suspended = false;
    const reduced = () => Boolean(preference?.matches);
    const editing = () => false;
    const excluded = element => !element || element.closest("[data-motion-ghost]");
    function visible(element) {
      if (!element.isConnected || excluded(element) || element.closest("[hidden]")) return false;
      for(let node=element;node && node !== document.body;node=node.parentElement) {
        const computed=window.getComputedStyle(node);
        if(computed.display === "none" || computed.visibility === "hidden")return false;
      }
      return true;
    }
    function viewport(rect) {return rect.width>0 && rect.height>0 && rect.bottom>0 && rect.right>0 && rect.top<(window.innerHeight || 900) && rect.left<(window.innerWidth || 1400);}
    function surface(element) {
      const slot=element.parentElement;
      return element.matches(".product-card") && slot?.matches(".catalog-slot[data-ui-shadow-shell],.catalog-slot[data-ui-appearance-shell]") ? slot : element;
    }
    function cancel(record,lane) {
      const animation=record.active.get(lane);
      if(animation)animation.cancel();
      record.active.delete(lane);
    }
    function cancelAll(record) {for(const lane of record.active.keys())cancel(record,lane);}
    function play(record,type,options={}) {
      const settings=configuration(record.config);
      const effect=settings[type];
      const target=options.target || surface(record.element);
      if(suspended || reduced() || !settings.enabled || !effect || effect === "none" || typeof target.animate !== "function")return false;
      if(editing() && !options.force)return false;
      cancel(record,type);
      if(type !== "entry")cancel(record,"entry");
      const computed=window.getComputedStyle(target);
      const opacity=Number.parseFloat(computed.opacity);
      const alpha=Number.isFinite(opacity) ? opacity : 1;
      const baseScale=computed.scale && computed.scale !== "none" ? computed.scale.split(/\s+/).map(Number) : [1,1];
      const scale=factor => `${(baseScale[0] || 1)*factor} ${(baseScale[1] || baseScale[0] || 1)*factor}`;
      const baseTranslate=computed.translate && computed.translate !== "none" ? computed.translate.split(/\s+/) : ["0px","0px"];
      const translate=(horizontal,vertical) => `calc(${baseTranslate[0]} + ${horizontal}px) calc(${baseTranslate[1] || "0px"} + ${vertical}px)`;
      const distance=settings.distance;
      const amount=Math.min(.07,distance/650);
      const vector={up:[0,distance],down:[0,-distance],left:[distance,0],right:[-distance,0]}[settings.direction];
      const base={opacity:alpha,translate:translate(0,0),scale:scale(1)};
      let frames;
      if(type === "entry" || type === "exit") {
        const edge={opacity:0};
        if(effect === "slide")edge.translate=translate(vector[0]*(type === "exit" ? -1 : 1),vector[1]*(type === "exit" ? -1 : 1));
        if(effect === "zoom" || effect === "pop")edge.scale=scale(1-amount);
        frames=type === "exit" ? [base,{...base,...edge}] : effect === "pop" ? [{...base,...edge},{...base,scale:scale(1+amount*.35),offset:.75},base] : [{...base,...edge},base];
      } else if(type === "hover") {
        const end={};
        if(effect === "lift")end.translate=translate(0,-Math.min(8,distance*.25));
        if(effect === "grow")end.scale=scale(1+amount*.6);
        if(effect === "tilt")end.rotate=`${(Number.parseFloat(computed.rotate) || 0)+Math.min(2,distance*.1)}deg`;
        if(effect === "glow")end.filter=`${computed.filter && computed.filter !== "none" ? computed.filter : ""} brightness(1.08)`.trim();
        const start={};
        Object.keys(end).forEach(key => {start[key]=key === "rotate" ? computed.rotate && computed.rotate !== "none" ? computed.rotate : "0deg" : key === "filter" ? computed.filter || "none" : base[key];});
        frames=[start,end];
      } else frames=effect === "pulse" ? [{scale:scale(1)},{scale:scale(1-amount)},{scale:scale(1+amount*.25)},{scale:scale(1)}] : [{scale:scale(1)},{scale:scale(1-amount)},{scale:scale(1)}];
      try {
        const animation=target.animate(frames,{duration:type === "hover" || type === "press" ? Math.min(300,settings.duration) : settings.duration,delay:type === "entry" ? Math.min(500,settings.delay+(options.index || 0)*settings.stagger) : 0,easing:timings[settings.easing],fill:options.hold ? "forwards" : "backwards"});
        record.active.set(type,animation);
        animation.finished.then(() => {if(record.active.get(type) === animation && !options.hold){record.active.delete(type);animation.cancel();}},() => {});
        return true;
      } catch {return false;}
    }
    function snapshot(record) {
      if(!visible(record.element))return;
      const target=surface(record.element);
      const rect=target.getBoundingClientRect();
      record.rect=viewport(rect) ? {left:rect.left,top:rect.top,width:rect.width,height:rect.height,right:rect.right,bottom:rect.bottom} : null;
      if(record.rect) {
        const computed=window.getComputedStyle(target);
        record.look={};
        ["display","background","border","border-radius","box-shadow","color","font-family","font-size","padding","box-sizing","opacity"].forEach(key => {record.look[key]=computed.getPropertyValue(key);});
        record.shell=target !== record.element;
      }
    }
    function enter(record,index=0,force=false) {
      if(!visible(record.element) || editing())return;
      snapshot(record);
      if(!record.rect || (!force && seen.has(record.key) && !record.config.repeat))return;
      if(play(record,"entry",{index}))seen.add(record.key);
    }
    function exit(record) {
      if(!record.rect || reduced() || editing() || ghosts.size>=16 || record.config.exit === "none" || !record.config.enabled)return;
      const clone=(record.shell && record.element.parentElement?.matches(".catalog-slot") ? record.element.parentElement : record.element).cloneNode(true);
      clone.dataset.motionGhost="";clone.inert=true;clone.setAttribute("aria-hidden","true");clone.removeAttribute("hidden");
      [clone,...clone.querySelectorAll("*")].forEach(node => {node.removeAttribute("id");node.removeAttribute("autofocus");});
      clone.querySelectorAll("script,iframe,audio,video").forEach(node => node.remove());
      clone.querySelectorAll("a,button,input,select,textarea,[tabindex]").forEach(node => {node.setAttribute("tabindex","-1");if(node.matches("button,input,select,textarea"))node.disabled=true;});
      Object.entries(record.look || {}).forEach(([key,value]) => {if(value)clone.style.setProperty(key,value,"important");});
      const style={position:"fixed",left:`${record.rect.left}px`,top:`${record.rect.top}px`,width:`${record.rect.width}px`,height:`${record.rect.height}px`,margin:"0",minHeight:"0",maxWidth:"none",maxHeight:"none",pointerEvents:"none",zIndex:"100",contain:"layout style",visibility:"visible"};
      Object.entries(style).forEach(([key,value]) => clone.style.setProperty(key.replace(/[A-Z]/g,letter=>`-${letter.toLowerCase()}`),value,"important"));
      document.body.append(clone);
      const ghost={...record,element:clone,active:new Map()};
      let timer;
      const remove=() => {window.clearTimeout(timer);cancelAll(ghost);clone.remove();ghosts.delete(clone);};
      ghosts.set(clone,remove);
      if(!play(ghost,"exit",{target:clone})) {remove();return;}
      timer=window.setTimeout(remove,record.config.duration+80);
      ghost.active.get("exit")?.finished.then(() => {window.clearTimeout(timer);remove();},() => {window.clearTimeout(timer);remove();});
    }
    const observer=typeof IntersectionObserver === "function" ? new IntersectionObserver(entries => {
      entries.forEach((entry,index) => {const record=records.get(entry.target);if(record && entry.isIntersecting)enter(record,index);});
    },{threshold:.04}) : null;
    function attach(record) {
      const {element}=record;
      const hover=() => {if(!editing())play(record,"hover",{hold:true});};
      const leave=() => cancel(record,"hover");
      const press=event => {if((event.type !== "keydown" || ["Enter"," "].includes(event.key)) && !event.repeat && (event.type !== "pointerdown" || event.button === 0) && event.target.closest("button,a,input,select,textarea") === element)play(record,"press");};
      record.listeners={pointerenter:hover,pointerleave:leave,pointercancel:leave,blur:leave,focus:hover,pointerdown:press,keydown:press};
      Object.entries(record.listeners).forEach(([type,handler]) => element.addEventListener(type,handler));
    }
    function detach(record) {
      observer?.unobserve(record.element);cancelAll(record);
      Object.entries(record.listeners).forEach(([type,handler]) => record.element.removeEventListener(type,handler));
    }
    function scan() {
      scheduled=false;
      if(suspended)return;
      const entries=provider().filter(entry => entry.config.enabled && ["entry","exit","hover","press"].some(key => entry.config[key] !== "none") && !excluded(entry.element) && visible(entry.element)).slice(0,600);
      const present=new Set(entries.map(entry => entry.element));
      const removed=[...records.values()].filter(record => !present.has(record.element));
      removed.filter(record => !visible(record.element) && !removed.some(parent => parent !== record && parent.element.contains(record.element))).forEach(exit);
      removed.forEach(record => {detach(record);records.delete(record.element);});
      const theme=document.body.dataset.storeDesign;
      const changedTheme=theme !== previousTheme;
      previousTheme=theme;
      entries.forEach((entry,index) => {
        let record=records.get(entry.element);
        if(!record) {
          record={...entry,active:new Map(),rect:null};records.set(entry.element,record);attach(record);snapshot(record);
          observer?.observe(entry.element);
          if(!observer)enter(record,index);
        } else {
          const wasVisible=Boolean(record.rect);
          if(JSON.stringify(record.config) !== JSON.stringify(entry.config))cancelAll(record);
          record.config=entry.config;snapshot(record);
          if(!observer && record.rect && !wasVisible)enter(record,index);
        }
        if(changedTheme && entry.config.entry !== "none")enter(record,index,true);
      });
    }
    function refresh() {if(!scheduled){scheduled=true;frame(scan);}}
    function stopMotion() {records.forEach(cancelAll);[...ghosts.values()].forEach(remove=>remove());}
        const preferenceChanged=() => {stopMotion();refresh();};
    preference?.addEventListener?.("change",preferenceChanged);
    new MutationObserver(changes => {if(changes.some(change => !excluded(change.target.nodeType === 1 ? change.target : change.target.parentElement)))refresh();}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["hidden","class","style"]});
    window.addEventListener("scroll",refresh,{passive:true});
    window.addEventListener("resize",refresh,{passive:true});
    window.addEventListener("pagehide",() => {suspended=true;stopMotion();});
    window.addEventListener("pageshow",() => {suspended=false;refresh();});
    engine={refresh,reduced};
    refresh();
    return engine;
  }

  const keys=new WeakMap();
  let sequence=0;
  function entries(){
    const found=new Map();
    for(const group of groups){
      for(const element of document.querySelectorAll(group.selector)){
        if(element.closest('[data-motion-ghost]'))continue;
        if(!keys.has(element))keys.set(element,++sequence);
        const card=element.closest('.product-card[data-product-id]');
        const catalog=document.body.dataset.catalogType||'local';
        const key=card?catalog+':'+card.dataset.productId+':'+group.id:group.id+':'+keys.get(element);
        found.set(element,{element,key,config:group.config});
      }
    }
    return [...found.values()];
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>start(entries),{once:true});
  else start(entries);
})();
