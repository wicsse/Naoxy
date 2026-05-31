function getPanelId(){return document.getElementById("ticket-panel-select")?.value||null;}
function getGid(){return window.location.pathname.split('/')[2]||'';}
function greenBtn(label,onclick){return '<button class="ts-green-btn" onclick="'+onclick+'">'+label+'</button>';}
function field(label,input,hint){return '<div class="ts-field"><div class="ts-label">'+label+(hint?' <span class="ts-hint-q" title="'+hint+'">?</span>':'')+'</div>'+input+'</div>';}
function toggle(id,label,checked){return '<div class="ts-toggle-row"><span class="ts-toggle-label">'+label+'</span><label class="ts-toggle"><input type="checkbox" id="'+id+'"'+(checked?' checked':'')+'><span class="ts-slider"></span></label></div>';}
function section(title,content){return '<div class="ts-section"><div class="ts-section-title">'+title+'</div>'+content+'</div>';}
function card(){return '<div class="ts-card">'+Array.from(arguments).join('')+'</div>';}
function saveRow(fn){return '<div class="ts-save-row"><button class="ts-save-btn" onclick="'+fn+'()">Sauvegarder</button></div>';}
function getVal(id){var el=document.getElementById(id);return el?el.value:'';}
function getCheck(id){var el=document.getElementById(id);return el?el.checked:false;}

function renderTicketSection(name,p,roles,channels){
  p=p||{};roles=roles||[];channels=channels||[];
  var rolesOpts=roles.map(function(r){return '<option value="'+r.id+'">'+r.name+'</option>';}).join('');
  var catChannels=channels.filter(function(c){return c.type===4;});
  var textChannels=channels.filter(function(c){return c.type===0;});
  var catOpts=catChannels.map(function(c){return '<option value="'+c.id+'"'+((p.category_open_id||p.category_id)==c.id?' selected':'')+'>'+c.name+'</option>';}).join('');
  var closedCatOpts=catChannels.map(function(c){return '<option value="'+c.id+'"'+((p.category_closed_id||p.closed_category_id)==c.id?' selected':'')+'>'+c.name+'</option>';}).join('');
  var textOpts=textChannels.map(function(c){return '<option value="'+c.id+'"'+(p.transcript_channel_id==c.id?' selected':'')+'>'+c.name+'</option>';}).join('');
  var logOpts=textChannels.map(function(c){return '<option value="'+c.id+'"'+(p.log_channel_id==c.id?' selected':'')+'>'+c.name+'</option>';}).join('');

  var supportOpts=roles.map(function(r){return '<option value="'+r.id+'"'+(p.support_role_id==r.id?' selected':'')+'>'+r.name+'</option>';}).join('');
  var additionalOpts=roles.map(function(r){return '<option value="'+r.id+'"'+(p.additional_role_id==r.id?' selected':'')+'>'+r.name+'</option>';}).join('');
  if(name==='general') return '<div class="ts-page">'+section('Roles de support',field('Roles support','<select class="ts-select" id="ts-support-roles"><option value="">Selectionner...</option>'+supportOpts+'</select>'))+section('Roles supplementaires',field('Roles supplementaires','<select class="ts-select" id="ts-additional-roles"><option value="">Selectionner...</option>'+additionalOpts+'</select>'))+saveRow('saveSectionGeneral')+'</div>';

  if(name==='category') return '<div class="ts-page">'+section('Categories',field('Ouverte','<select class="ts-select" id="ts-cat-open"><option value="">Aucune</option>'+catOpts+'</select>')+field('Fermee','<select class="ts-select" id="ts-cat-closed"><option value="">Aucune</option>'+closedCatOpts+'</select>'))+saveRow('saveSectionCategory')+'</div>';

  if(name==='ticket') return '<div class="ts-page"><div class="ts-two-col">'+section('Message du Ticket',greenBtn('Modifier le message du Ticket',"openMessageEditor('ticket_message')"))+section('Confirmation de fermeture',greenBtn('Modifier la question de fermeture',"openMessageEditor('close_question')")+'</div>')+section('Ticket',field('Nom ouvert','<input class="ts-input" id="ts-open-name" value="'+(p.name_format||'ticket-{username}')+'">','')+field('Nom ferme','<input class="ts-input" id="ts-closed-name" value="'+(p.closed_name_format||'closed-{username}')+'">',''))+section('Fermeture en deux etapes',toggle('ts-two-step','Activer la fermeture en deux etapes',p.two_step_close))+section('Message de fermeture',greenBtn('Modifier le message de fermeture',"openMessageEditor('closed_message')"))+section('Message ouverture',greenBtn('Modifier le message ouverture',"openMessageEditor('opened_message')"))+saveRow('saveSectionTicket')+'</div>';

  if(name==='moderator') return '<div class="ts-page"><div class="ts-two-col">'+section('Message moderateur',greenBtn('Modifier le message moderateur',"openMessageEditor('moderator_message')"))+section('Message de suppression',greenBtn('Modifier le message de suppression',"openMessageEditor('delete_message')")+'</div>')+'</div>';

  if(name==='permissions') return '<div class="ts-page"><div class="ts-two-col">'+section('Permissions equipe support','<div class="ts-btn-row"><button class="ts-green-btn" style="flex:1" onclick="openPermEditor(\'support\',\'open\')">Modifier ouvert</button><button class="ts-yellow-btn" style="flex:1" onclick="openPermEditor(\'support\',\'close\')">Modifier ferme</button></div>')+section('Permissions proprietaire','<div class="ts-btn-row"><button class="ts-green-btn" style="flex:1" onclick="openPermEditor(\'owner\',\'open\')">Modifier ouvert</button><button class="ts-yellow-btn" style="flex:1" onclick="openPermEditor(\'owner\',\'close\')">Modifier ferme</button></div>')+'</div><div class="ts-two-col">'+section('Roles supplementaires Permissions','<div class="ts-btn-row"><button class="ts-green-btn" style="flex:1" onclick="openPermEditor(\'additional\',\'open\')">Modifier ouvert</button><button class="ts-yellow-btn" style="flex:1" onclick="openPermEditor(\'additional\',\'close\')">Modifier ferme</button></div>')+section('Permissions tout le monde','<div class="ts-btn-row"><button class="ts-green-btn" style="flex:1" onclick="openPermEditor(\'everyone\',\'open\')">Modifier ouvert</button><button class="ts-yellow-btn" style="flex:1" onclick="openPermEditor(\'everyone\',\'close\')">Modifier ferme</button></div>')+'</div></div>';

  if(name==='buttons') return '<div class="ts-page"><div class="ts-sub">Acces rapide a tous les boutons</div><div class="ts-btn-grid">'+['Creer un ticket','Fermer le ticket','Annuler la fermeture','Rouvrir le ticket','Confirmer la fermeture','Supprimer le ticket'].map(function(b){return '<div class="ts-btn-card"><div class="ts-btn-card-title">'+b+'</div>'+greenBtn('Modifier le bouton',"openButtonEditor('"+b.toLowerCase().replace(/ /g,'_')+"')")+'</div>';}).join('')+'</div><div class="ts-btn-grid"><div class="ts-btn-card"><div class="ts-btn-card-title">Transcript</div>'+greenBtn('Modifier le bouton',"openButtonEditor('transcript')")+'</div><div class="ts-btn-card"><div class="ts-btn-card-title">Reclamer le ticket</div>'+greenBtn('Modifier le bouton',"openButtonEditor('claim_ticket')")+'</div></div></div>';

  if(name==='messages') return '<div class="ts-page"><div class="ts-sub">Acces rapide a tous les messages</div><div class="ts-msg-grid">'+[['Modifier le message du panel','panel_message'],['Modifier le DM de fermeture','closed_dm'],['Modifier le DM de creation','created_dm'],['Modifier le message de reclamation','claimed_message'],['Modifier le message de liberation','unclaimed_message'],['Modifier le message de fermeture','closed_message'],['Modifier le message ouverture','opened_message'],['Modifier le message moderateur','moderator_message'],['Modifier le message de suppression','delete_message'],['Modifier le message du ticket','ticket_message'],['Modifier la question de fermeture','close_question'],['Modifier le message de transcript','transcript_message']].map(function(x){return greenBtn(x[0],"openMessageEditor('"+x[1]+"')");}).join('')+'</div></div>';

  if(name==='panel') return '<div class="ts-page">'+section('Message du panel',greenBtn('Modifier le message du Panel',"openMessageEditor('panel_message')"))+section('Boutons par ligne','<div class="ts-counter"><button class="ts-counter-btn" onclick="document.getElementById(\'ts-btns-per-row\').stepDown()">-</button><input class="ts-counter-input" type="number" id="ts-btns-per-row" value="'+(p.buttons_per_row||3)+'" min="1" max="5"><button class="ts-counter-btn" onclick="document.getElementById(\'ts-btns-per-row\').stepUp()">+</button></div>')+saveRow('saveSectionPanel')+'</div>';

  if(name==='transcript') return '<div class="ts-page">'+section('Transcript',field('Salon','<select class="ts-select" id="ts-transcript-channel"><option value="">Selectionner...</option>'+textOpts+'</select>'))+section('Message de transcript',greenBtn('Modifier le message de transcript',"openMessageEditor('transcript_message')"))+saveRow('saveSectionTranscript')+'</div>';

  if(name==='escalate') return '<div class="ts-page">'+section('Escalader',field('Role','<select class="ts-select" id="ts-esc-role"><option value="">-- Aucun --</option>'+rolesOpts+'</select>'))+section('Message escalade',greenBtn('Modifier le message escalade',"openMessageEditor('escalate_message')"))+saveRow('saveSectionEscalate')+'</div>';

  if(name==='claiming') return '<div class="ts-page">'+section('Reclamation',toggle('ts-claiming-enabled','Activer la reclamation',p.claiming_enabled))+section('Message de reclamation',greenBtn('Modifier le message de reclamation',"openMessageEditor('claimed_message')"))+section('Message de liberation',greenBtn('Modifier le message de liberation',"openMessageEditor('unclaimed_message')"))+saveRow('saveSectionClaiming')+'</div>';

  if(name==='logging') return '<div class="ts-page">'+section('Logs',field('Salon de logs','<select class="ts-select" id="ts-log-channel"><option value="">Selectionner...</option>'+logOpts+'</select>'))+saveRow('saveSectionLogging')+'</div>';

  if(name==='automation') return '<div class="ts-page">'+section('Automatisation',toggle('ts-auto-close','Fermeture automatique',p.auto_close_enabled)+field('Delai (heures)','<input class="ts-input" type="number" id="ts-auto-close-hours" value="'+(p.auto_close_hours||24)+'">'))+saveRow('saveSectionAutomation')+'</div>';

  if(name==='limits') return '<div class="ts-page">'+section('Limites',field('Tickets max par utilisateur','<input class="ts-input" type="number" id="ts-max-tickets" value="'+(p.max_tickets||1)+'">'))+saveRow('saveSectionLimits')+'</div>';

  if(name==='forms') return '<div class="ts-page">'+section('Formulaires',toggle('ts-form-enabled','Activer les formulaires',p.form_enabled)+field('Titre du formulaire','<input class="ts-input" id="ts-form-title" value="'+(p.form_title||'Merci de remplir ceci')+'">'))+saveRow('saveSectionForms')+'</div>';

  if(name==='integrations') return '<div class="ts-page">'+section('Integrations','<div class="ts-small-text">Integrations de bots externes disponibles avec la version premium.</div>')+'</div>';

  if(name==='dropdown_style') {
    var gid=getGid();
    var panelId=getPanelId();
    return '<div class="ts-page">'+
      section('Sujets du menu déroulant',
        '<div id="ts-categories-list" style="margin-bottom:12px;"></div>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">'+
          '<input class="ts-input" id="ts-cat-emoji" placeholder="Emoji ex: 🎫" style="width:80px">'+
          '<input class="ts-input" id="ts-cat-label" placeholder="Nom du sujet ex: Support" style="flex:1">'+
          '<select class="ts-select" id="ts-cat-channel" style="flex:1"><option value="">Catégorie Discord (optionnel)</option>'+catOpts+'</select>'+
          '<select class="ts-select" id="ts-cat-role" style="flex:1"><option value="">Rôle support (optionnel)</option>'+rolesOpts+'</select>'+
          '<button class="ts-save-btn" onclick="addTicketCategory()">+ Ajouter</button>'+
        '</div>'
      )+'</div>';
  }

  return '<div class="ts-page">'+section(name,'<div class="ts-small-text">En cours de developpement.</div>')+'</div>';
}

function openSection(name){
  var id=getPanelId();
  if(!id){toast('Aucun panel selectionne','error');return;}
  var view=document.getElementById('ticket-section-view');
  var main=document.getElementById('ticket-main-content')||document.querySelector('#page-tickets > div:not(#ticket-section-view)');
  if(main) main.style.display='none';
  if(view) view.style.display='block';
  var titles={general:'General',category:'Categorie',ticket:'Ticket',moderator:'Moderateur',permissions:'Permissions',buttons:'Boutons',messages:'Messages',escalate:'Escalader',panel:'Panel',command_style:'Style Commande',dropdown_style:'Style Menu Deroulant',thread_style:'Style Thread',forms:'Formulaires',transcript:'Transcript',logging:'Logs',automation:'Automatisation',limits:'Limites',claiming:'Reclamation',integrations:'Integrations'};
  var title=document.getElementById('ticket-section-title');
  if(title) title.textContent=titles[name]||name;
  var content=document.getElementById('ticket-section-content');
  var gid=getGid();
  Promise.all([
    api('/ticket-panels/'+id).catch(function(){return {};}),
    api('/roles').catch(function(){return [];}),
    api('/channels').catch(function(){return [];})
  ]).then(function(results){
    content.innerHTML=renderTicketSection(name,results[0]||{},results[1]||[],results[2]||[]);
    if(name==='dropdown_style') loadTicketCategories();
  });
}

function closeSection(){
  var view=document.getElementById('ticket-section-view');
  if(view) view.style.display='none';
  var main=document.getElementById('ticket-main-content')||document.querySelector('#page-tickets > div:not(#ticket-section-view)');
  if(main) main.style.display='';
}

async function patchPanel(data){
  var id=getPanelId();
  if(!id) return;
  try{const r=await apiPatch('/ticket-panels/'+id,data);if(r&&r.error){toast('Erreur: '+r.error,'error');}else{toast('Sauvegarde !','success');}}catch(e){console.error('patchPanel error',e);toast('Erreur: '+e.message,'error');}
}

async function saveSectionGeneral(){await patchPanel({support_role_id:getVal('ts-support-roles')});}
async function saveSectionCategory(){await patchPanel({category_id:getVal('ts-cat-open'),closed_category_id:getVal('ts-cat-closed')});}
async function saveSectionTicket(){await patchPanel({name_format:getVal('ts-open-name'),closed_name_format:getVal('ts-closed-name'),two_step_close:getCheck('ts-two-step')});}
async function saveSectionPanel(){await patchPanel({buttons_per_row:getVal('ts-btns-per-row')});}
async function saveSectionTranscript(){await patchPanel({transcript_channel_id:getVal('ts-transcript-channel')});}
async function saveSectionEscalate(){await patchPanel({escalate_role_id:getVal('ts-esc-role')});}
async function saveSectionClaiming(){await patchPanel({claiming_enabled:getCheck('ts-claiming-enabled')});}
async function saveSectionLogging(){await patchPanel({log_channel_id:getVal('ts-log-channel')});}
async function saveSectionAutomation(){await patchPanel({auto_close_enabled:getCheck('ts-auto-close'),auto_close_hours:getVal('ts-auto-close-hours')});}
async function saveSectionLimits(){await patchPanel({max_tickets:getVal('ts-max-tickets')});}
async function saveSectionForms(){await patchPanel({form_enabled:getCheck('ts-form-enabled'),form_title:getVal('ts-form-title')});}

function openButtonEditor(type){toast('Editeur de boutons bientot disponible','info');}

function openPermEditor(type,state){
  var id=getPanelId();
  if(!id){toast('Aucun panel selectionne','error');return;}
  var stateName=state==='open'?'Support Ouvert':'Support Ferme';
  var view=document.getElementById('ticket-section-view');
  var title=document.getElementById('ticket-section-title');
  if(title) title.textContent='Permissions - '+stateName;
  var perms=[
    {cat:'Permissions generales du salon',list:['Voir le salon','Gerer le salon','Gerer les permissions','Gerer les webhooks']},
    {cat:'Permissions de membership',list:['Creer une invitation']},
    {cat:'Permissions du salon texte',list:['Envoyer des messages','Envoyer dans les threads','Creer des threads publics','Creer des threads prives','Integrer des liens','Joindre des fichiers','Ajouter des reactions','Emojis externes','Stickers externes','Mentionner everyone','Gerer les messages','Gerer les threads','Lire historique','Messages TTS','Commandes application','Messages vocaux']}
  ];
  var content=document.getElementById('ticket-section-content');
  var html='<div style="max-width:860px;margin:0 auto;background:#1a1625;border:1px solid #2d2640;border-radius:10px;padding:20px">';
  perms.forEach(function(group){
    html+='<div style="font-size:11px;color:#9ca3af;margin:14px 0 8px">'+group.cat+'</div>';
    group.list.forEach(function(perm){
      html+='<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid #2d264022">';
      html+='<div style="display:flex;align-items:center;gap:8px"><span style="width:8px;height:8px;background:#22c55e;border-radius:50%;display:inline-block"></span><span style="font-size:13px;color:#e5e7eb">'+perm+'</span></div>';
      html+='<div style="display:flex;gap:6px"><button style="background:#ef444422;color:#ef4444;border:1px solid #ef444444;border-radius:4px;width:24px;height:24px;cursor:pointer">x</button><button style="background:#37415144;color:#9ca3af;border:1px solid #37415166;border-radius:4px;width:24px;height:24px;cursor:pointer">/</button><button style="background:#16a34a33;color:#22c55e;border:1px solid #16a34a66;border-radius:4px;width:24px;height:24px;cursor:pointer">v</button></div></div>';
    });
  });
  html+='<div style="margin-top:16px;border-top:1px solid #2d2640;padding-top:12px;font-size:12px;color:#9ca3af">Ticket Tool doit avoir la permission globalement</div></div>';
  content.innerHTML=html;
  if(view) view.style.display='block';
  var mainContent=document.getElementById('ticket-main-content');
  if(mainContent) mainContent.style.display='none';
}

function openMessageEditor(type){
  var id=getPanelId();
  if(!id){toast('Aucun panel selectionne','error');return;}
  var typeNames={ticket_message:'Message Ticket',close_question:'Confirmation fermeture',closed_message:'Message ferme',opened_message:'Message ouvert',moderator_message:'Message moderateur',delete_message:'Message suppression',panel_message:'Message du panel',closed_dm:'DM fermeture',created_dm:'DM creation',claimed_message:'Message reclamation',unclaimed_message:'Message liberation',transcript_message:'Message transcript',escalate_message:'Message escalade',schedule_message:'Message notification'};
  var typeName=typeNames[type]||type;
  var view=document.getElementById('ticket-section-view');
  var title=document.getElementById('ticket-section-title');
  if(title) title.textContent=typeName;
  var content=document.getElementById('ticket-section-content');
  content.innerHTML='<div style="max-width:860px;margin:0 auto"><div style="background:#1a1625;border:1px solid #2d2640;border-radius:10px;overflow:hidden;margin-bottom:16px"><div style="padding:14px 16px;border-bottom:1px solid #2d2640;display:flex;justify-content:space-between;align-items:center"><span style="font-size:13px;font-weight:600;color:#e5e7eb">Editeur embed - 1</span><button style="background:#ef4444;color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:12px;cursor:pointer">Supprimer</button></div><div style="padding:16px;display:flex;flex-direction:column;gap:12px"><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px"><input class="ts-input" id="me-author" placeholder="Nom auteur"><input class="ts-input" id="me-author-img" placeholder="URL image auteur"><input class="ts-input" id="me-author-link" placeholder="URL lien auteur"></div><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px"><input class="ts-input" id="me-title" placeholder="Titre"><input class="ts-input" id="me-thumbnail" placeholder="URL miniature"><input class="ts-input" id="me-title-link" placeholder="URL lien titre"></div><textarea class="ts-input" id="me-description" rows="4" placeholder="Description..." style="resize:vertical;width:100%;box-sizing:border-box"></textarea><div style="background:#12101e;border:1px solid #2d2640;border-radius:8px;padding:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span style="font-size:13px;font-weight:600;color:#a78bfa">Editeur de champs</span><button style="background:#16a34a;color:#fff;border:none;border-radius:6px;padding:5px 12px;font-size:12px;cursor:pointer">Ajouter un champ</button></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px"><input class="ts-input" id="me-color-hex" placeholder="#HEX couleur"><input class="ts-input" id="me-image" placeholder="URL image"></div><div style="display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center"><input class="ts-input" id="me-footer-url" placeholder="URL footer"><label style="display:flex;align-items:center;gap:6px;font-size:12px;color:#9ca3af;white-space:nowrap"><input type="checkbox" id="me-datetime"> Date et heure</label><input class="ts-input" id="me-footer" placeholder="Texte footer"></div></div></div></div><div style="background:#1a1625;border:1px solid #2d2640;border-radius:10px;padding:16px;margin-bottom:16px"><div style="font-size:13px;font-weight:600;color:#a78bfa;margin-bottom:12px">Apercu du message</div><div style="background:#313338;border-radius:8px;padding:16px;min-height:80px"><div style="display:flex;align-items:flex-start;gap:12px"><div style="width:36px;height:36px;background:#5865f2;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">T</div><div style="flex:1"><div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span style="font-weight:600;color:#fff;font-size:14px">Orbis</span><span style="background:#5865f2;color:#fff;font-size:10px;padding:1px 4px;border-radius:3px">BOT</span></div><div id="me-preview-embed" style="border-left:4px solid #16a34a;background:#2b2d31;border-radius:0 4px 4px 0;padding:10px 12px;max-width:450px"><div id="me-preview-desc" style="color:#dbdee1;font-size:13px;white-space:pre-wrap"></div></div></div></div></div></div><div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="ts-green-btn" style="width:auto;padding:10px 24px" id="me-save-btn">Sauvegarder</button></div></div>';
  setTimeout(function(){
    var desc=document.getElementById('me-description');
    var prev=document.getElementById('me-preview-desc');
    var col=document.getElementById('me-color-hex');
    var emb=document.getElementById('me-preview-embed');
    var btn=document.getElementById('me-save-btn');
    if(desc&&prev) desc.addEventListener('input',function(){prev.textContent=desc.value;});
    if(col&&emb) col.addEventListener('input',function(){if(/^#[0-9A-Fa-f]{6}$/.test(col.value)) emb.style.borderLeftColor=col.value;});
    if(btn) btn.onclick=function(){saveMessageEditor(type);};
  },100);
  var templates={
    ticket_message:{embed_title:'🎫 Ticket_{name}',embed_description:'Bonjour {user} 👋\n\nMerci d\'avoir ouvert un ticket. Le staff va vous répondre dès que possible.\n\nDécrivez votre demande ci-dessous.',embed_color:'#7c3aed',embed_footer:'Ouvert par {user}',embed_author:''},
    closed_message:{embed_title:'🔒 Ticket Fermé',embed_description:'Votre ticket a été fermé.\n\nSi vous avez d\'autres questions, n\'hésitez pas à ouvrir un nouveau ticket.',embed_color:'#ef4444',embed_footer:'Fermé par {closer}',embed_author:''},
    opened_message:{embed_title:'✅ Ticket Ouvert',embed_description:'Bonjour {user} 👋\n\nUn membre du staff va vous répondre rapidement.',embed_color:'#22c55e',embed_footer:'',embed_author:''},
    panel_message:{embed_title:'🎫 Ouvrir un ticket',embed_description:'Cliquez sur le bouton ci-dessous pour ouvrir un ticket.\nNotre équipe vous répondra dès que possible.',embed_color:'#7c3aed',embed_footer:'',embed_author:''},
    close_question:{embed_title:'❓ Fermer le ticket ?',embed_description:'Êtes-vous sûr de vouloir fermer ce ticket ?',embed_color:'#f59e0b',embed_footer:'',embed_author:''},
    moderator_message:{embed_title:'🛡️ Message Modérateur',embed_description:'Un modérateur a rejoint votre ticket.',embed_color:'#3b82f6',embed_footer:'',embed_author:''},
    claimed_message:{embed_title:'✋ Ticket Réclamé',embed_description:'Ce ticket a été pris en charge par {staff}.',embed_color:'#8b5cf6',embed_footer:'',embed_author:''},
    unclaimed_message:{embed_title:'🔓 Ticket Libéré',embed_description:'Ce ticket a été libéré par {staff}.',embed_color:'#6b7280',embed_footer:'',embed_author:''},
    transcript_message:{embed_title:'📄 Transcript Sauvegardé',embed_description:'Le transcript de votre ticket a été sauvegardé.',embed_color:'#0ea5e9',embed_footer:'',embed_author:''},
    closed_dm:{embed_title:'🔒 Ticket Fermé',embed_description:'Votre ticket a été fermé.\n\nMerci d\'avoir contacté le support.',embed_color:'#ef4444',embed_footer:'',embed_author:''},
    created_dm:{embed_title:'🎫 Ticket Créé',embed_description:'Votre ticket a bien été créé ! Un membre du staff va vous répondre rapidement.',embed_color:'#22c55e',embed_footer:'',embed_author:''},
    escalate_message:{embed_title:'⬆️ Ticket Escaladé',embed_description:'Ce ticket a été escaladé à un niveau supérieur.',embed_color:'#f97316',embed_footer:'',embed_author:''},
    delete_message:{embed_title:'🗑️ Ticket Supprimé',embed_description:'Ce ticket a été supprimé.',embed_color:'#ef4444',embed_footer:'',embed_author:''}
  };
  var loadType={ticket_message:'open',opened_message:'open',closed_message:'close',panel_message:'panel',close_question:'close_question'}[type]||type;
  api('/ticket-panels/'+id+'/messages/'+loadType).then(function(m){
    if(!m||(!m.embed_title&&!m.embed_description&&!m.embed_color&&!m.embed_footer&&!m.embed_author)){m=templates[type]||{};}
    if(document.getElementById('me-title')) document.getElementById('me-title').value=m.embed_title||'';
    if(document.getElementById('me-description')){document.getElementById('me-description').value=m.embed_description||'';if(document.getElementById('me-preview-desc')) document.getElementById('me-preview-desc').textContent=m.embed_description||'';}
    if(document.getElementById('me-color-hex')){document.getElementById('me-color-hex').value=m.embed_color||'#16a34a';if(document.getElementById('me-preview-embed')&&m.embed_color) document.getElementById('me-preview-embed').style.borderLeftColor=m.embed_color;}
    if(document.getElementById('me-footer')) document.getElementById('me-footer').value=m.embed_footer||'';
    if(document.getElementById('me-author')) document.getElementById('me-author').value=m.embed_author||'';
  }).catch(function(){});
  if(view) view.style.display='block';
  var mc=document.getElementById('ticket-main-content');
  if(mc) mc.style.display='none';
}

async function saveMessageEditor(type){
  var id=getPanelId();
  if(!id||!type) return;
  var typeMap={ticket_message:'open',opened_message:'open',closed_message:'close',panel_message:'panel',close_question:'close_question'};
  var dbType=typeMap[type]||type;
  var data={embed_title:getVal('me-title'),embed_description:getVal('me-description'),embed_color:getVal('me-color-hex'),embed_footer:getVal('me-footer'),embed_author:getVal('me-author')};
  try{await apiPost('/ticket-panels/'+id+'/messages/'+dbType,data);toast('Sauvegarde !','success');}catch(e){toast('Erreur: '+e.message,'error');}
}

async function loadTicketCategories() {
  var id = getPanelId();
  var gid = getGid();
  if (!id) return;
  try {
    var cats = await api('/ticket-panels/' + id + '/categories');
    var list = document.getElementById('ts-categories-list');
    if (!list) return;
    if (!cats || cats.length === 0) {
      list.innerHTML = '<div class="ts-small-text">Aucun sujet configuré.</div>';
      return;
    }
    list.innerHTML = cats.map(function(c) {
      return '<div style="display:flex;align-items:center;gap:8px;padding:8px;background:var(--bg2);border-radius:8px;margin-bottom:6px;">' +
        '<span style="font-size:20px">' + (c.emoji || '🎫') + '</span>' +
        '<span style="flex:1;font-weight:600">' + c.label + '</span>' +
        '<button class="ts-save-btn" style="background:var(--red)" onclick="deleteTicketCategory(' + c.id + ')">Supprimer</button>' +
        '</div>';
    }).join('');
  } catch(e) { console.error(e); }
}

async function addTicketCategory() {
  var id = getPanelId();
  var gid = getGid();
  var emoji = document.getElementById('ts-cat-emoji')?.value || '🎫';
  var label = document.getElementById('ts-cat-label')?.value;
  var category_id = document.getElementById('ts-cat-channel')?.value || null;
  var support_role_id = document.getElementById('ts-cat-role')?.value || null;
  if (!label) { toast('Le nom du sujet est requis', 'error'); return; }
  try {
    await fetch('/api/guild/' + gid + '/ticket-panels/' + id + '/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label, emoji, category_id, support_role_id })
    });
    document.getElementById('ts-cat-emoji').value = '';
    document.getElementById('ts-cat-label').value = '';
    toast('Sujet ajouté !', 'success');
    loadTicketCategories();
  } catch(e) { toast('Erreur: ' + e.message, 'error'); }
}

async function deleteTicketCategory(catId) {
  var id = getPanelId();
  var gid = getGid();
  try {
    await fetch('/api/guild/' + gid + '/ticket-panels/' + id + '/categories/' + catId, { method: 'DELETE' });
    toast('Sujet supprimé !', 'success');
    loadTicketCategories();
  } catch(e) { toast('Erreur: ' + e.message, 'error'); }
}
