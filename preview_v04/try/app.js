const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const root=$('#root'); let S={kind:'tour',filters:{},cmp:new Set(),res:null};
const toast=(t)=>{const e=document.createElement('div');e.className='toast';e.textContent=t;document.body.append(e);setTimeout(()=>e.remove(),2600)};
const KINDS={tour:'Туры',hotel:'Отели',flight:'Авиабилеты',cruise:'Круизы'};
const NAV=[['search','🔎 Поиск'],['collections','🧩 Подборки'],['crm','📋 Заявки (CRM)'],['plans','💳 Тарифы'],['guide','❓ Как это работает']];

async function boot(){ await Catalog.load(); addEventListener('hashchange',render); render(); }
function go(h){ location.hash=h; }
function render(){
  const c=Store.ctx(); const route=(location.hash||'#/').slice(2).split('/');
  if(!c){ return route[0]==='login'?authView('login'):authView('register'); }
  const acc=Store.access(c.org); const page=route[0]||'search';
  const blocked=!acc.active && !['plans','guide'].includes(page);
  root.innerHTML=`<div class="app"><aside class="side"><a class="logo" href="../">LETI<b style="color:#ff6b4a">VO</b></a>
   ${NAV.map(([k,t])=>`<a class="nl ${page===k||(k==='collections'&&page==='collection')?'on':''}" href="#/${k}">${t}</a>`).join('')}
   <a class="nl" href="../">← На сайт</a>
   <div class="who"><b>${esc(c.org.name)}</b><br>${esc(c.user.email)}<br>${acc.mode==='trial'?`Пробный период: ${acc.days_left} дн.`:acc.mode==='expired'?'Пробный период закончился':'Тариф: '+PLANS[c.org.plan].title}<br><a href="#" id="out" style="color:#fff">Выйти</a></div></aside>
   <main class="main"><div class="notice mb">🧪 <b>Тестовая версия.</b> Цены и туроператоры вымышленные. Данные хранятся только в вашем браузере. Реальные цены появятся после подключения туроператоров по договору.</div><div id="v"></div></main></div>`;
  $('#out').onclick=e=>{e.preventDefault();Store.logout();go('#/login')};
  const v=$('#v');
  if(blocked){ v.innerHTML=`<div class="card"><h2>Пробный период закончился</h2><p>Ваши подборки и заявки сохранены. Выберите тариф, чтобы продолжить работу.</p><a class="btn" href="#/plans">Выбрать тариф</a></div>`; return; }
  ({search:viewSearch,collections:viewCollections,collection:viewCollection,crm:viewCrm,plans:viewPlans,guide:viewGuide}[page]||viewSearch)(v,c,route);
}
/* ---------- вход / регистрация ---------- */
function authView(mode){
  const reg=mode==='register';
  root.innerHTML=`<div class="wrap"><div class="auth card"><a class="logo" href="../" style="font-size:26px">LETI<b>VO</b></a>
  <h2 class="mt">${reg?'Регистрация турагентства':'Вход в кабинет'}</h2>${reg?'<p class="mut">14 дней бесплатно. Карта не нужна.</p>':''}
  <form id="f" class="mt">
   ${reg?`<label>Название агентства</label><input name="org_name" required minlength="2" placeholder="Например, «Вояж Тюмень»"><div class="mt"></div><label>Город</label><input name="city" placeholder="Тюмень"><div class="mt"></div><label>Ваше имя</label><input name="name" required><div class="mt"></div>`:''}
   <label>Email</label><input name="email" type="email" required><div class="mt"></div>
   <label>Пароль ${reg?'(не короче 8 символов)':''}</label><input name="password" type="password" required minlength="${reg?8:1}">
   ${reg?`<label class="mt sm" style="display:flex;gap:8px;font-weight:400"><input type="checkbox" name="consent" style="width:auto" required> Согласен на обработку персональных данных и с условиями (в тестовой версии данные остаются в браузере)</label>`:''}
   <div id="err" class="notice err mt" hidden></div>
   <button class="btn mt" style="width:100%">${reg?'Начать бесплатный период':'Войти'}</button></form>
  <p class="sm mt">${reg?'Уже есть кабинет? <a href="#/login">Войти</a>':'Нет кабинета? <a href="#/register">Зарегистрироваться</a>'}</p>
  <p class="sm mut">Тест: не вводите свои реальные пароли, используйте любой пароль для проверки.</p></div></div>`;
  $('#f').onsubmit=async e=>{e.preventDefault();const f=Object.fromEntries(new FormData(e.target));f.consent=!!f.consent;
    try{ reg?await Store.register(f):await Store.login(f.email,f.password); go('#/search'); render(); }catch(x){const b=$('#err');b.hidden=false;b.textContent=x.message}};
}
/* ---------- поиск ---------- */
function filterForm(kind){
  const d=Catalog.data; const countries=[...new Set(d[{tour:'tours',hotel:'hotels',flight:'flights',cruise:'cruises'}[kind]].map(x=>x.country))].sort();
  const cities=['Москва','Санкт-Петербург','Екатеринбург','Тюмень','Новосибирск','Казань']; const f=S.filters;
  const sel=(n,l,opts)=>`<div><label>${l}</label><select name="${n}"><option value="">Любой</option>${opts.map(o=>`<option ${f[n]===o?'selected':''}>${esc(o)}</option>`).join('')}</select></div>`;
  const inp=(n,l,t='text',ph='')=>`<div><label>${l}</label><input name="${n}" type="${t}" placeholder="${ph}" value="${esc(f[n]||'')}"></div>`;
  const parts=[sel('country','Страна',countries)];
  if(kind!=='cruise')parts.push(inp('place','Курорт / город'));
  if(kind==='tour'||kind==='flight')parts.push(sel('depart_city','Город вылета',cities));
  if(kind!=='hotel'||true)parts.push(inp('date_from','Не раньше даты','date'));
  if(kind==='tour'||kind==='hotel')parts.push(sel('stars_min','Звёзды от',['3','4','5']));
  parts.push(inp('price_max','Цена до, ₽','number','100000'));
  return `<form id="sf" class="card mb"><div class="row">${parts.join('')}<div style="flex:0 0 auto;align-self:end"><button class="btn">Найти</button></div></div></form>`;
}
function offerCard(o){
  const m=[o.stars?'★'.repeat(o.stars):'',o.meal,o.nights?o.nights+' ноч.':'',o.depart_city?'из '+o.depart_city:'',o.date_from?'с '+o.date_from.split('-').reverse().join('.'):'',o.rating?'рейтинг '+o.rating:'',o.airline,o.stops===0?'без пересадок':o.stops?'1 пересадка':''].filter(Boolean);
  const op=Catalog.ops[o.operator_id]?.name||'';
  return `<div class="card offer"><div class="flex"><span class="em">${o.emoji}</span><span class="badge">ДЕМО</span></div><b>${esc(o.title)}</b><div class="sm mut">${esc(o.country)} · ${esc(o.place)}</div>
  <div class="sm">${m.map(esc).join(' · ')}</div><div>${(o.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join(' ')}</div>
  <div class="pr">${rub(o.price_rub)}</div><div class="sm mut">${esc(o.per||'')}<br>Оператор: ${esc(op)}</div>
  <div class="acts"><label class="sm" style="display:flex;gap:4px;align-items:center;margin:0"><input type="checkbox" style="width:auto" data-cmp="${o.id}" ${S.cmp.has(o.id)?'checked':''}>сравнить</label>
  <button class="btn sm sec" data-add="${o.id}">+ В подборку</button><button class="btn sm ghost" data-go="${o.id}">На сайт оператора ↗</button></div></div>`;
}
function viewSearch(v,c){
  v.innerHTML=`<div class="bar"><h1>Поиск и сравнение</h1></div><div class="tabs">${Object.entries(KINDS).map(([k,t])=>`<div class="tab ${S.kind===k?'on':''}" data-k="${k}">${t}</div>`).join('')}</div>${filterForm(S.kind)}<div id="res"></div>`;
  $$('.tab',v).forEach(t=>t.onclick=()=>{S.kind=t.dataset.k;S.filters={};S.cmp.clear();viewSearch(v,c)});
  const run=()=>{const items=Catalog.search(S.kind,S.filters);$('#res').innerHTML=`<p class="sm mut">Найдено: ${items.length}. Цены демонстрационные (на ${Catalog.data.generated}).</p><div class="grid">${items.slice(0,60).map(offerCard).join('')||'<p>Ничего не найдено. Ослабьте фильтры.</p>'}</div>${cmpBar()}`;bind()};
  const bind=()=>{
    $$('[data-cmp]').forEach(i=>i.onchange=()=>{i.checked?S.cmp.add(i.dataset.cmp):S.cmp.delete(i.dataset.cmp);if(S.cmp.size>4){S.cmp.delete(i.dataset.cmp);i.checked=false;toast('Максимум 4 предложения')}$('.bottombar')?.remove();$('#res').insertAdjacentHTML('beforeend',cmpBar());bindBar()});
    $$('[data-add]').forEach(b=>b.onclick=()=>{const d=c.d;if(!d.draft.includes(b.dataset.add)){d.draft.push(b.dataset.add);Store.save(d)}toast('Добавлено в подборку ('+d.draft.length+')')});
    $$('[data-go]').forEach(b=>b.onclick=()=>openOperator(b.dataset.go));bindBar();
  };
  $('#sf').onsubmit=e=>{e.preventDefault();S.filters=Object.fromEntries([...new FormData(e.target)].filter(([,v])=>v));run()};
  run();
}
const cmpBar=()=>S.cmp.size?`<div class="bottombar"><span>Выбрано: ${S.cmp.size}</span><button class="btn sm" id="cmpgo" ${S.cmp.size<2?'disabled':''}>Сравнить</button></div>`:'';
function bindBar(){const b=$('#cmpgo');if(b)b.onclick=showCompare}
function openOperator(id){
  const c=Store.ctx(),o=Catalog.byId[id],op=Catalog.ops[o.operator_id];c.d.clicks.push({org_id:c.org.id,offer_id:id,created_at:now()});Store.save(c.d);
  window.open(op.site+'&offer='+encodeURIComponent(id),'_blank');
}
function showCompare(){
  const items=[...S.cmp].map(i=>Catalog.byId[i]);const min=Math.min(...items.map(x=>x.price_rub));
  const rows=[['Предложение',x=>esc(x.title)],['Направление',x=>esc(x.country+', '+x.place)],['Цена',x=>`<b>${rub(x.price_rub)}</b><br><span class="mut">${esc(x.per||'')}</span>`,1],['Даты',x=>x.date_from?x.date_from+(x.date_to?' → '+x.date_to:''):'—'],['Ночей',x=>x.nights||'—'],['Класс',x=>x.stars?'★'.repeat(x.stars):'—'],['Питание',x=>esc(x.meal||'—')],['Вылет',x=>esc(x.depart_city||'—')],['Оператор',x=>esc(Catalog.ops[x.operator_id].name)]];
  const m=document.createElement('div');m.className='modal';m.innerHTML=`<div class="box"><div class="flex"><h2 style="margin:0">Сравнение</h2><button class="btn ghost sm" style="margin-left:auto" id="x">Закрыть</button></div>
  <div style="overflow:auto"><table class="cmp mt"><tr><th></th>${items.map(()=>'<th></th>').join('')}</tr>${rows.map(([l,f,p])=>`<tr><th>${l}</th>${items.map(x=>`<td class="${p&&x.price_rub===min?'best':''}">${f(x)}${p&&x.price_rub===min?'<br>✅ дешевле всех':''}</td>`).join('')}</tr>`).join('')}
  <tr><th></th>${items.map(x=>`<td><button class="btn sm sec" data-a="${x.id}">+ В подборку</button> <button class="btn sm ghost" data-g="${x.id}">На сайт оператора ↗</button></td>`).join('')}</tr></table></div></div>`;
  document.body.append(m);$('#x',m).onclick=()=>m.remove();
  $$('[data-a]',m).forEach(b=>b.onclick=()=>{const c=Store.ctx();if(!c.d.draft.includes(b.dataset.a)){c.d.draft.push(b.dataset.a);Store.save(c.d)}toast('Добавлено в подборку')});
  $$('[data-g]',m).forEach(b=>b.onclick=()=>openOperator(b.dataset.g));
}
/* ---------- подборки ---------- */
function viewCollections(v,c){
  const list=Store.mine(c,'collections').slice().reverse(), dr=c.d.draft;
  v.innerHTML=`<div class="bar"><h1>Подборки</h1><a class="btn" style="margin-left:auto" href="#/collection/new">+ Новая подборка${dr.length?` (из ${dr.length} выбранных)`:''}</a></div>
  ${list.length?`<div class="grid">${list.map(x=>`<div class="card"><b>${esc(x.title)}</b><div class="sm mut">${x.offers.length} предложений${x.client_name?' · для '+esc(x.client_name):''}</div><div class="mt"><a class="btn sm" href="#/collection/${x.id}">Открыть</a> <button class="btn sm bad" data-del="${x.id}">Удалить</button></div></div>`).join('')}</div>`:`<div class="card"><h3>Пока нет подборок</h3><p>Найдите предложения в поиске, нажмите «+ В подборку», затем создайте подборку: получите ссылку для клиента, текст для Telegram, карточки сторис и сценарий Reels.</p><a class="btn" href="#/search">Перейти к поиску</a></div>`}`;
  $$('[data-del]',v).forEach(b=>b.onclick=()=>{if(confirm('Удалить подборку?')){c.d.collections=c.d.collections.filter(x=>!(x.id==b.dataset.del&&x.org_id===c.org.id));Store.save(c.d);viewCollections(v,c)}});
}
const encodeShare=(c,x)=>{const j={t:x.token,a:c.org.name,city:c.org.city,title:x.title,intro:x.intro,cl:x.client_name,o:x.offers.map(o=>{const s=Catalog.byId[o.offer_id];return{id:s.id,e:s.emoji,ti:s.title,p:s.price_rub,pe:s.per,d:s.date_from,pl:s.place+', '+s.country,n:o.note||'',op:Catalog.ops[s.operator_id].name}})};return btoa(unescape(encodeURIComponent(JSON.stringify(j))))};
function viewCollection(v,c,route){
  const id=route[1]; let x=id==='new'?{title:'',intro:'',client_name:'',offers:c.d.draft.map(i=>({offer_id:i,note:''}))}:c.d.collections.find(k=>k.id==id&&k.org_id===c.org.id);
  if(!x){v.innerHTML='<div class="notice err">Подборка не найдена</div>';return}
  const saved=!!x.id;
  v.innerHTML=`<div class="bar"><a href="#/collections">← Все подборки</a><h1>${saved?esc(x.title):'Новая подборка'}</h1></div>
  <div class="card mb"><div class="row"><div><label>Название</label><input id="t" value="${esc(x.title)}" placeholder="Море в мае для семьи"></div><div><label>Для кого (клиент)</label><input id="cl" value="${esc(x.client_name)}"></div></div>
  <label class="mt">Вступление</label><textarea id="in" rows="2" placeholder="Подобрала 3 варианта под ваш бюджет">${esc(x.intro)}</textarea>
  <h3 class="mt">Предложения</h3><div id="of"></div><div class="mt flex"><button class="btn" id="sv">${saved?'Сохранить':'Создать подборку'}</button><a class="btn ghost" href="#/search">+ Добавить из поиска</a></div></div><div id="cout"></div>`;
  const drawOffers=()=>{$('#of').innerHTML=x.offers.length?x.offers.map((o,i)=>{const s=Catalog.byId[o.offer_id];return`<div class="card mb"><div class="flex"><b>${s.emoji} ${esc(s.title)}</b><span class="mut sm">${rub(s.price_rub)}</span><button class="btn sm ghost" style="margin-left:auto" data-rm="${i}">Убрать</button></div><input class="mt" data-note="${i}" placeholder="Ваш комментарий клиенту (необязательно)" value="${esc(o.note||'')}"></div>`}).join(''):'<p class="mut">Пусто. Добавьте предложения из поиска.</p>';
    $$('[data-rm]').forEach(b=>b.onclick=()=>{x.offers.splice(+b.dataset.rm,1);if(!saved)c.d.draft=x.offers.map(o=>o.offer_id);Store.save(c.d);drawOffers()});
    $$('[data-note]').forEach(i=>i.oninput=()=>x.offers[+i.dataset.note].note=i.value)};
  drawOffers();
  $('#sv').onclick=()=>{if(!$('#t').value.trim())return toast('Введите название');if(!x.offers.length)return toast('Добавьте предложения');
    const k=Store.saveCollection(c,{id:x.id,title:$('#t').value.trim(),intro:$('#in').value,client_name:$('#cl').value,offers:x.offers});c.d.draft=[];Store.save(c.d);toast('Сохранено');go('#/collection/'+k.id);render()};
  if(saved)contentBlock($('#cout'),c,x);
}
function contentBlock(el,c,x){
  const agency=c.org.name, link=location.href.replace(/app\.html.*$/,'c.html#')+encodeShare(c,x), tg=Content.telegram(x,agency), sl=Content.slides(x,agency), rl=Content.reels(x,agency);
  el.innerHTML=`<div class="card mb"><h3>🔗 Ссылка для клиента</h3><p class="sm mut">Откроется красивой страницей с заявкой. В тестовой версии заявка попадает в ваш кабинет, если открыть ссылку в этом же браузере.</p><input readonly value="${esc(link)}" onclick="this.select()"><div class="mt flex"><button class="btn sm" id="cp1">Скопировать ссылку</button><a class="btn sm sec" href="${esc(link)}" target="_blank">Открыть как клиент</a></div></div>
  <div class="card mb"><h3>✈️ Сообщение для Telegram</h3><pre class="tg" id="tg">${esc(tg)}</pre><div class="flex"><button class="btn sm" id="cp2">Скопировать текст</button><a class="btn sm sec" target="_blank" href="https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(tg)}">Отправить в Telegram</a></div><p class="sm mut mt">Бот агентства, который сам отвечает клиентам и ведёт подбор, в разработке. Сейчас вы отправляете сообщение сами.</p></div>
  <div class="card mb"><h3>📱 Сторис</h3><p class="sm mut">Готовые кадры 1080×1920. Скачайте и опубликуйте в Instagram или MAX. Автопубликация появится после подключения ваших аккаунтов.</p><div class="flex" id="sl"></div><div class="mt flex"><button class="btn sm" id="dlall">Скачать все кадры</button></div></div>
  <div class="card mb"><h3>🎬 Reels</h3><table class="cmp">${rl.map(b=>`<tr><th style="width:110px">${esc(b.t)}</th><td>${esc(b.say)}<br><span class="mut">Кадр: ${esc(b.show)}</span></td></tr>`).join('')}</table><div class="mt flex"><button class="btn sm" id="vid">Собрать видео из кадров</button><span class="sm mut" id="vs">Видео 1080×1920 (WebM, без звука)</span></div><video id="vp" controls style="max-width:240px;margin-top:10px" hidden></video></div>`;
  const q=(id,fn)=>$(id).onclick=fn;
  q('#cp1',()=>navigator.clipboard.writeText(link).then(()=>toast('Ссылка скопирована')));
  q('#cp2',()=>navigator.clipboard.writeText(tg).then(()=>toast('Текст скопирован')));
  sl.forEach((s,i)=>{const cv=document.createElement('canvas');cv.className='story';Content.draw(cv,s,agency);$('#sl').append(cv)});
  const dl=(cv,n)=>{const a=document.createElement('a');a.href=cv.toDataURL('image/png');a.download=n;a.click()};
  q('#dlall',()=>$$('#sl canvas').forEach((cv,i)=>setTimeout(()=>dl(cv,`letivo-story-${i+1}.png`),i*300)));
  q('#vid',async()=>{if(!window.MediaRecorder){return toast('Браузер не поддерживает запись видео, скачайте кадры')}
    const cv=document.createElement('canvas');Content.draw(cv,sl[0],agency);const st=cv.captureStream(30);const rec=new MediaRecorder(st,{mimeType:MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm'});const ch=[];rec.ondataavailable=e=>ch.push(e.data);
    rec.onstop=()=>{const b=new Blob(ch,{type:'video/webm'});const u=URL.createObjectURL(b);const p=$('#vp');p.src=u;p.hidden=false;$('#vs').innerHTML=`Готово. <a download="letivo-reels.webm" href="${u}">Скачать видео</a>`};
    rec.start();for(let i=0;i<sl.length;i++){Content.draw(cv,sl[i],agency);$('#vs').textContent=`Запись: кадр ${i+1} из ${sl.length}`;await new Promise(r=>setTimeout(r,2200))}rec.stop()});
}
/* ---------- CRM ---------- */
function viewCrm(v,c){
  const leads=Store.mine(c,'leads');
  v.innerHTML=`<div class="bar"><h1>Заявки (CRM)</h1><button class="btn" style="margin-left:auto" id="nl">+ Заявка вручную</button></div>
  <p class="sm mut">Сюда приходят заявки со страниц подборок. Каждая с отметкой согласия на обработку данных. Меняйте этап в карточке.</p>
  <div class="kan">${Object.entries(STATUS).map(([k,t])=>`<div class="col"><h4>${t} (${leads.filter(l=>l.status===k).length})</h4>${leads.filter(l=>l.status===k).reverse().map(l=>`<div class="lc"><b>${esc(l.name)}</b><br>${esc(l.phone||l.email||'')}<div class="mut">${esc(l.message||'')}</div><div class="sm mut">${l.source==='collection'?'📩 со страницы подборки':'✍️ вручную'}${l.consent_at?' · ✔ согласие':''}</div>
   <select data-st="${l.id}" class="mt">${Object.entries(STATUS).map(([a,b])=>`<option value="${a}" ${a===l.status?'selected':''}>${b}</option>`).join('')}</select>
   <div class="mt">${c.d.notes.filter(n=>n.lead_id===l.id).map(n=>`<div class="sm">📝 ${esc(n.text)}</div>`).join('')}<input data-note="${l.id}" placeholder="Заметка + Enter" style="margin-top:6px"></div></div>`).join('')}</div>`).join('')}</div>`;
  $$('[data-st]',v).forEach(s=>s.onchange=()=>{Store.setLead(c,+s.dataset.st,{status:s.value});viewCrm(v,c)});
  $$('[data-note]',v).forEach(i=>i.onkeydown=e=>{if(e.key==='Enter'&&i.value.trim()){Store.addNote(c,+i.dataset.note,i.value.trim());viewCrm(v,c)}});
  $('#nl').onclick=()=>{const n=prompt('Имя клиента');if(!n)return;Store.addLead(c,{name:n,phone:prompt('Телефон или email')||'',message:prompt('Запрос (куда, когда, бюджет)')||''});viewCrm(v,c)};
}
/* ---------- тарифы ---------- */
function viewPlans(v,c){
  const acc=Store.access(c.org);
  v.innerHTML=`<div class="bar"><h1>Тарифы</h1></div><div class="notice mb">Цены предварительные. Оплата в тестовой версии не подключена: вы оставляете заявку на тариф, менеджер свяжется с вами.</div>
  <div class="plans">${Object.entries(PLANS).map(([k,p])=>`<div class="card plan ${p.hot?'hot':''}"><h3>${p.title}</h3><div class="price">${p.price?rub(p.price):'0 ₽'}</div><div class="sm mut">${p.period}</div><ul class="sm">${p.features.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>
  ${k==='trial'?`<div class="badge t">${acc.mode==='trial'?`Осталось ${acc.days_left} дн.`:'Закончился'}</div>`:c.org.plan_requested===k?'<div class="badge y">Заявка отправлена</div>':`<button class="btn sm" data-p="${k}">Выбрать</button>`}</div>`).join('')}</div>`;
  $$('[data-p]',v).forEach(b=>b.onclick=()=>{Store.requestPlan(b.dataset.p);toast('Заявка на тариф сохранена');viewPlans(v,Store.ctx())});
}
function viewGuide(v){
  v.innerHTML=`<div class="bar"><h1>Как это работает</h1></div><div class="card"><ol><li><b>Поиск.</b> Выберите вкладку (туры, отели, авиа, круизы), задайте фильтры.</li><li><b>Сравнение.</b> Отметьте до 4 предложений галочкой «сравнить».</li><li><b>Подборка.</b> Нажмите «+ В подборку», потом «Новая подборка», добавьте комментарии.</li><li><b>Клиенту.</b> Отправьте ссылку или текст в Telegram. Заявка клиента придёт в «Заявки».</li><li><b>Контент.</b> Скачайте сторис-кадры или соберите видео для Reels.</li><li><b>Бронирование.</b> Кнопка «На сайт оператора» открывает сайт туроператора, где вы бронируете самостоятельно.</li></ol>
  <h3>Что пока в разработке</h3><ul><li>Реальные цены туроператоров (нужны договоры и доступ к их API).</li><li>Telegram-бот агентства.</li><li>Автопубликация сторис и Reels (нужны подключённые аккаунты).</li><li>Онлайн-оплата тарифов.</li></ul></div>`;
}
boot();
