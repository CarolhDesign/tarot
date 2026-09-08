/**
 * TAROT DE MARSEILLE — Netlify Function
 * Reproduit le serveur MongoDB, mais chaque requête apporte SA propre config MongoDB
 * (URI + dbName) via les en-têtes, pour que chaque utilisatrice ait sa base privée.
 */

const { MongoClient } = require('mongodb');

/* Cache de connexions par URI (réutilisé entre invocations chaudes) */
const _clients = {};
async function getDb(uri, dbName){
  if(!uri) return null;
  try{
    if(!_clients[uri]){
      const client = new MongoClient(uri, { maxPoolSize: 5 });
      await client.connect();
      _clients[uri] = client;
    }
    return _clients[uri].db(dbName || 'tarot');
  }catch(e){
    delete _clients[uri];
    throw e;
  }
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-DB-URI, X-DB-NAME',
  'Content-Type': 'application/json'
};

function ok(body){ return { statusCode: 200, headers: CORS, body: JSON.stringify(body) }; }
function err(msg, code){ return { statusCode: code||500, headers: CORS, body: JSON.stringify({ ok:false, error: msg }) }; }

/* Route clé-valeur : un seul document _type:'all' avec un champ nommé */
async function kv(db, coll, field, method, body){
  if(method==='GET'){
    const doc = await db.collection(coll).findOne({ _type:'all' });
    return ok(doc ? (doc[field] ?? (Array.isArray(doc[field])?[]:{})) : (field==='data'?{}:[]));
  }
  if(method==='POST'){
    await db.collection(coll).updateOne(
      { _type:'all' },
      { $set: { _type:'all', [field]: body[field] ?? (field==='data'?{}:[]), updatedAt:new Date() } },
      { upsert:true }
    );
    return ok({ ok:true });
  }
  return err('Méthode non supportée', 405);
}

/* Route collection : documents avec uid */
async function coll(db, name, mapper, method, body, params, buildSet){
  if(method==='GET'){
    const rows = await db.collection(name).find({}).sort({ createdAt:-1 }).toArray();
    return ok(rows.map(mapper));
  }
  if(method==='POST'){
    const uid = String(body._id || body.uid || Date.now());
    await db.collection(name).updateOne({ uid }, { $set: buildSet(uid, body) }, { upsert:true });
    return ok({ ok:true });
  }
  if(method==='DELETE' && params.uid){
    await db.collection(name).deleteOne({ uid: params.uid });
    return ok({ ok:true });
  }
  return err('Méthode non supportée', 405);
}

module.exports = async (req, res) => {
  /* CORS */
  Object.entries(CORS).forEach(([k,v])=>res.setHeader(k,v));
  if(req.method === 'OPTIONS'){ res.status(204).end(); return; }

  /* Adaptateur : réponse au format {statusCode, headers, body} → res Vercel */
  const send = (r)=>{ res.status(r.statusCode); res.setHeader('Content-Type','application/json'); res.end(r.body); };

  /* Route demandée : tout ce qui suit le domaine, ex: /api/tirages */
  let route = (req.url||'').split('?')[0].replace(/\/+$/,'') || '/api';
  const method = req.method;
  const urlObj = new URL(req.url, 'http://x');
  const params = Object.fromEntries(urlObj.searchParams.entries());
  let body = {};
  try{ body = typeof req.body==='object' && req.body ? req.body : (req.body ? JSON.parse(req.body) : {}); }catch(e){}

  const h = req.headers || {};
  const uri    = h['x-db-uri']  || '';
  const dbName = h['x-db-name'] || 'tarot';

  if(route === '/api/db/test'){
    if(!uri) return send(ok({ ok:false, error:'Pas d\'URI' }));
    try{ const db = await getDb(uri, dbName); await db.command({ ping: 1 }); return send(ok({ ok:true })); }
    catch(e){ return send(ok({ ok:false, error: e.message })); }
  }

  if(!uri) return send(err('MongoDB non configuré', 503));

  let db;
  try{ db = await getDb(uri, dbName); }
  catch(e){ return send(err('Connexion MongoDB impossible : ' + e.message, 503)); }

  try{
    /* ── Routes clé-valeur ── */
    if(route==='/api/mini-syntheses')  return send(await kv(db, 'mini_syntheses', 'syntheses', method, body));
    if(route==='/api/syntheses-mois')  return send(await kv(db, 'syntheses_mois', 'syntheses', method, body));
    if(route==='/api/rappels')         return send(await kv(db, 'rappels', 'rappels', method, body));
    if(route==='/api/grimoire')        return send(await kv(db, 'grimoire', 'entrees', method, body));
    if(route==='/api/card-interps')    return send(await kv(db, 'card_interps', 'data', method, body));
    if(route==='/api/assoc-globales')  return send(await kv(db, 'assoc_globales', 'data', method, body));
    if(route==='/api/livre-ref')       return send(await kv(db, 'livre_ref', 'data', method, body));
    if(route==='/api/methodes')        return send(await kv(db, 'methodes', 'methodes', method, body));
    if(route==='/api/relations')       return send(await kv(db, 'relations', 'data', method, body));
    if(route==='/api/cards-override')  return send(await kv(db, 'cards_override', 'data', method, body));
    if(route==='/api/params')          return send(await kv(db, 'params', 'data', method, body));
    if(route==='/api/profil')          return send(await kv(db, 'profil', 'data', method, body));

    /* ── Collections avec uid ── */
    if(route==='/api/defunts'){
      return await coll(db, 'defunts',
        r => ({ ...r, _id: r.uid || String(r._id) }),
        method, body, params,
        (uid, b) => ({ ...b, uid, createdAt:new Date() }));
    }
    if(route==='/api/histoires'){
      return await coll(db, 'histoires',
        r => ({ _id: r.uid || String(r._id), titre: r.titre, texte: r.texte }),
        method, body, params,
        (uid, b) => ({ uid, titre: b.titre||'', texte: b.texte||'', createdAt:new Date() }));
    }
    if(route==='/api/tarots'){
      return await coll(db, 'tarots',
        r => ({ _id: r.uid || String(r._id), nom: r.nom, cartes: r.cartes||[] }),
        method, body, params,
        (uid, b) => ({ uid, nom: b.nom, cartes: b.cartes||[], createdAt:new Date() }));
    }
    if(route==='/api/tirages'){
      if(method==='GET'){
        const rows = await db.collection('tirages').find({}).sort({ createdAt:-1 }).toArray();
        return send(ok(rows.map(r => ({ ...r, id: r.uid || String(r._id) }))));
      }
      if(method==='POST'){
        const uid = String(body.id || body.uid || Date.now());
        await db.collection('tirages').updateOne({ uid }, { $set: { ...body, uid, createdAt: body.createdAt || new Date() } }, { upsert:true });
        return send(ok({ ok:true }));
      }
      if(method==='DELETE' && params.uid){
        await db.collection('tirages').deleteOne({ uid: params.uid });
        return send(ok({ ok:true }));
      }
    }

    return send(err('Route inconnue : ' + route, 404));
    }catch(e){
    return send(err('Erreur serveur : ' + e.message, 500));
  }
};
