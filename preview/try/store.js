/* LETIVO демо-хранилище. Всё лежит в вашем браузере (localStorage), на сервер ничего не уходит.
   Те же правила, что в backend/app.py: пробный период, изоляция агентств, согласие, демо-пометки. */
const TRIAL_DAYS = 14;
const KEY = 'letivo_demo_v1';
const STATUS = {new:'Новые', in_work:'В работе', offer_sent:'Подборка отправлена', booked:'Забронировано', lost:'Потеряно'};
const PLANS = {
  trial:{title:'Пробный период',price:0,period:'14 дней',features:['Поиск и сравнение','Конструктор подборок','CRM заявок','Текст для Telegram, сторис и Reels']},
  start:{title:'Старт',price:1900,period:'в месяц',features:['Всё из пробного','Ссылка на подборку с вашим именем','Карточки сторис']},
  pro:{title:'Профи',price:4900,period:'в месяц',hot:true,features:['Всё из «Старт»','Telegram-бот агентства (в разработке)','Сценарии Reels и видео-заготовки','5 сотрудников']},
  agency:{title:'Агентство',price:9900,period:'в месяц',features:['Всё из «Профи»','Свой домен кабинета','Автопубликация (после подключения аккаунтов)','20 сотрудников']}
};
const rub = n => Number(n).toLocaleString('ru-RU').replace(/ /g,' ') + ' ₽';
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const now = () => new Date().toISOString();

const Store = {
  db(){ try{ return JSON.parse(localStorage.getItem(KEY)) || this.fresh(); }catch(e){ return this.fresh(); } },
  fresh(){ return {users:[],orgs:[],session:null,collections:[],leads:[],notes:[],clicks:[],draft:[],seq:1}; },
  save(d){ localStorage.setItem(KEY, JSON.stringify(d)); },
  id(d){ return d.seq++; },
  async sha(s){ const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('letivo-demo:'+s)); return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join(''); },
  async register({email,password,name,org_name,city,consent}){
    const d = this.db(); email = email.trim().toLowerCase();
    if(!consent) throw new Error('Нужно согласие на обработку персональных данных');
    if(password.length < 8) throw new Error('Пароль не короче 8 символов');
    if(d.users.some(u=>u.email===email)) throw new Error('Этот email уже зарегистрирован');
    const org = {id:this.id(d), name:org_name, city, plan:'trial', plan_requested:null, trial_ends_at:new Date(Date.now()+TRIAL_DAYS*864e5).toISOString(), created_at:now()};
    const user = {id:this.id(d), email, name, pw:await this.sha(password), org_id:org.id, consent_at:now()};
    d.orgs.push(org); d.users.push(user); d.session = user.id; this.save(d); return user;
  },
  async login(email,password){
    const d = this.db(); const u = d.users.find(u=>u.email===email.trim().toLowerCase());
    if(!u || u.pw !== await this.sha(password)) throw new Error('Неверный email или пароль');
    d.session = u.id; this.save(d); return u;
  },
  logout(){ const d=this.db(); d.session=null; this.save(d); },
  ctx(){ const d=this.db(); const u=d.users.find(u=>u.id===d.session); if(!u) return null; return {d,user:u,org:d.orgs.find(o=>o.id===u.org_id)}; },
  access(org){
    if(org.plan!=='trial') return {active:true,mode:'paid'};
    const left = Math.ceil((new Date(org.trial_ends_at)-Date.now())/864e5);
    return left>0 ? {active:true,mode:'trial',days_left:left} : {active:false,mode:'expired',days_left:0};
  },
  requestPlan(plan){ const c=this.ctx(); c.org.plan_requested=plan; this.save(c.d); },
  // подборки
  saveCollection(c0,{id,title,intro,client_name,offers}){
    const {d,org}=c0; let c = id && d.collections.find(x=>x.id===id && x.org_id===org.id);
    if(!c){ c={id:this.id(d),org_id:org.id,token:Math.random().toString(36).slice(2,10)+Date.now().toString(36),created_at:now()}; d.collections.push(c); }
    Object.assign(c,{title,intro,client_name,offers}); this.save(d); return c;
  },
  mine(c0,key){ return c0.d[key].filter(x=>x.org_id===c0.org.id); },
  addLead(c0,l){ const d=c0.d; const x={id:this.id(d),org_id:c0.org.id,status:'new',source:'manual',created_at:now(),...l}; d.leads.push(x); this.save(d); return x; },
  setLead(c0,id,patch){ const x=c0.d.leads.find(l=>l.id===id&&l.org_id===c0.org.id); if(x){Object.assign(x,patch); this.save(c0.d);} },
  addNote(c0,lead_id,text){ if(!c0.d.leads.find(l=>l.id===lead_id&&l.org_id===c0.org.id)) return; c0.d.notes.push({id:this.id(c0.d),lead_id,text,created_at:now()}); this.save(c0.d); },
  publicLead(token,l){ // заявка клиента со страницы подборки (работает, если кабинет открыт в этом же браузере)
    const d=this.db(); const c=d.collections.find(c=>c.token===token); if(!c) return false;
    d.leads.push({id:this.id(d),org_id:c.org_id,collection_id:c.id,status:'new',source:'collection',consent_at:now(),created_at:now(),...l}); this.save(d); return true;
  }
};

// поиск по демо-каталогу (те же фильтры, что в backend/providers/demo.py)
const Catalog = {
  data:null,
  async load(){ if(!this.data){ const r=await fetch('data/demo_catalog.json'); this.data=await r.json(); this.byId={}; ['tours','hotels','flights','cruises'].forEach(k=>this.data[k].forEach(x=>this.byId[x.id]=x)); this.ops=Object.fromEntries(this.data.operators.map(o=>[o.id,o])); } return this.data; },
  search(kind,f){
    const key={tour:'tours',hotel:'hotels',flight:'flights',cruise:'cruises'}[kind]; const q=s=>(s||'').toString().trim().toLowerCase();
    let r=this.data[key].filter(x=>
      (!f.country||q(x.country)===q(f.country)) && (!f.place||q(x.place).includes(q(f.place))||q(x.title).includes(q(f.place))) &&
      (!f.depart_city||!x.depart_city||x.depart_city===f.depart_city) && (!f.date_from||!x.date_from||x.date_from>=f.date_from) &&
      (!f.price_max||x.price_rub<=+f.price_max) && (!f.stars_min||(x.stars||0)>=+f.stars_min) && (!f.nights_min||(x.nights||99)>=+f.nights_min));
    return r.sort((a,b)=>f.sort==='date'?(a.date_from||'').localeCompare(b.date_from||''):a.price_rub-b.price_rub);
  }
};

// тексты (зеркало backend/content.py)
const Content = {
  telegram(c,agency){
    const L=['✨ '+c.title]; if(c.client_name)L.push('Для: '+c.client_name); if(c.intro)L.push('',c.intro); L.push('');
    c.offers.forEach((o,i)=>{const s=Catalog.byId[o.offer_id]; L.push(`${i+1}. ${s.emoji} ${s.title}${s.date_from?', '+s.date_from:''}\n   от ${rub(s.price_rub)} ${s.per||''}`); if(o.note)L.push('   💬 '+o.note);});
    L.push('','Цены на момент составления подборки, наличие и цену уточняем перед бронированием.','— '+agency); return L.join('\n');
  },
  slides(c,agency){
    const s=[{type:'cover',title:c.title,subtitle:c.intro||'Подборка от турагента'}];
    c.offers.slice(0,6).forEach(o=>{const x=Catalog.byId[o.offer_id]; s.push({type:'offer',emoji:x.emoji,title:x.title,line:'от '+rub(x.price_rub),per:x.per||'',note:o.note||''});});
    s.push({type:'cta',title:'Хотите так же?',subtitle:'Напишите нам: '+agency}); return s;
  },
  reels(c,agency){
    const b=[{t:'0-3 c',say:`Ищете, куда поехать? Покажу ${c.offers.length} вариант(а).`,show:'заставка с названием подборки'}];
    c.offers.slice(0,5).forEach((o,i)=>{const x=Catalog.byId[o.offer_id]; b.push({t:`${3+i*5}-${8+i*5} c`,say:`${i+1}. ${x.title}. От ${rub(x.price_rub)} ${x.per||''}.`,show:'карточка предложения '+(i+1)});});
    b.push({t:'последние 3 c',say:'Напишите «подборка», и мы подберём под ваш бюджет и даты.',show:'контакты: '+agency}); return b;
  },
  // рисуем кадр 1080x1920 на canvas
  draw(cv,s,agency){
    const W=1080,H=1920; cv.width=W; cv.height=H; const g=cv.getContext('2d');
    const gr=g.createLinearGradient(0,0,W,H); gr.addColorStop(0,'#0f4c5c'); gr.addColorStop(.6,'#16697a'); gr.addColorStop(1,'#ff6b4a'); g.fillStyle=gr; g.fillRect(0,0,W,H);
    g.fillStyle='rgba(255,255,255,.08)'; g.beginPath(); g.arc(W-100,260,380,0,7); g.fill(); g.beginPath(); g.arc(120,H-300,300,0,7); g.fill();
    const wrap=(t,x,y,mw,lh,font,color)=>{g.font=font;g.fillStyle=color;g.textAlign='center';const w=(t||'').split(' ');let l='';for(const a of w){const tt=l?l+' '+a:a;if(g.measureText(tt).width>mw&&l){g.fillText(l,x,y);y+=lh;l=a;}else l=tt;}g.fillText(l,x,y);return y+lh;};
    g.font='bold 44px system-ui';g.fillStyle='#ffb703';g.textAlign='center';g.fillText(agency.toUpperCase().slice(0,28),W/2,150);
    if(s.type==='cover'){wrap('✨',W/2,640,900,150,'160px system-ui','#fff');let y=wrap(s.title,W/2,860,880,120,'bold 100px system-ui','#fff');wrap(s.subtitle,W/2,y+40,860,66,'48px system-ui','#fff3e0');}
    else if(s.type==='offer'){wrap(s.emoji,W/2,620,900,200,'260px system-ui','#fff');let y=wrap(s.title,W/2,900,900,100,'bold 80px system-ui','#fff');y=wrap(s.line,W/2,y+60,900,110,'bold 110px system-ui','#ffb703');y=wrap(s.per,W/2,y,900,60,'40px system-ui','#fff3e0');if(s.note)wrap('💬 '+s.note,W/2,y+60,860,60,'44px system-ui','#fff');}
    else{let y=wrap(s.title,W/2,860,900,130,'bold 120px system-ui','#fff');wrap(s.subtitle,W/2,y+40,860,70,'52px system-ui','#fff3e0');}
    g.font='34px system-ui';g.fillStyle='rgba(255,255,255,.75)';g.textAlign='center';g.fillText('Демо-цены, перед бронированием уточняйте',W/2,H-80);
  }
};
