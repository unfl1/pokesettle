// Standalone, loopback-only synthetic API for Server Component fetch tests.
import http from 'node:http';
import fs from 'node:fs';
const routes = JSON.parse(fs.readFileSync(new URL('../src/generated/pokemon-routes.json', import.meta.url)));
const byId = new Map(routes.map(item => [item.pokemonId, item]));
let ready = false;
let images = false;
let failedIds = [];
const summary = id => ({ ...byId.get(id), pokemonId: id, speciesId: Number(id.split(':')[1]), nameKo: byId.get(id)?.names.ko ?? null, nameEn: byId.get(id)?.names.en ?? id, types: id === 'pokemon:1' ? ['grass','poison'] : ['electric'], scope: 'generic', championsEligibilityStatus: 'unknown' });
function detail(id) {
  const pokemon = summary(id);
  if (id === 'pokemon:205') pokemon.nameKo = '전체테스트205';
  return { ...pokemon, images: images ? { spriteUrl: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/25.png', artworkUrl: null, sourceUrl: 'https://github.com/PokeAPI/sprites' } : null, baseStats: { hp:35,attack:55,defense:40,spAttack:50,spDefense:50,speed:90 }, abilities: ['static','lightning-rod'], abilityDetails: [{name:'static',nameKo:'정전기',names:{ko:'정전기',en:'Static',ja:'せいでんき',zh:'静电'}},{name:'lightning-rod',nameKo:'피뢰침',names:{ko:'피뢰침',en:'Lightning Rod',ja:'ひらいしん',zh:'避雷针'}}], description: `${pokemon.nameKo} 도감 설명`, descriptionVersion:'shield', descriptions:{ko:{text:`${pokemon.nameKo} 도감 설명`,version:'shield'},en:{text:'English fixture description.',version:'shield'},ja:{text:'日本語のテスト説明。',version:'shield'},zh:{text:'中文测试描述。',version:'shield'}}, sourceUrl:`https://pokeapi.co/api/v2/pokemon/${id.split(':')[1]}/`, learnset: {versionGroup:'champions',moves:[{name:'10만볼트',nameEn:'thunderbolt',names:{ko:'10만볼트',en:'Thunderbolt',ja:'１０まんボルト',zh:'十万伏特'},method:'train',level:0,type:'electric',category:'special',power:90,accuracy:100},{name:'울음소리',nameEn:'growl',names:{ko:'울음소리',en:'Growl',ja:'なきごえ',zh:'叫声'},method:'level-up',level:1,type:'normal',category:'status',power:null,accuracy:100}]} };
}
const server = http.createServer(async (req,res) => {
  const url = new URL(req.url, 'http://fixture');
  const send = (data,status=200) => { res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({data})); };
  if (url.pathname === '/__fixture' && req.method === 'POST') {
    let body=''; for await (const chunk of req) body+=chunk;
    const config=JSON.parse(body);ready=!!config.ready;images=!!config.images;failedIds=config.failedIds??[];return send({ready});
  }
  if (url.pathname === '/api/status') return send({ready:true,metadataCount:1351,missing:[]});
  if (url.pathname === '/api/session') return send({active:true});
  if (url.pathname === '/api/conversations') return send({items:[],total:0});
  if (url.pathname === '/health') return send({ready:true});
  if (url.pathname === '/api/pokemon') return ready ? send({items:['pokemon:25','pokemon:1'].map(summary),total:2,limit:100,offset:0}) : send(null,503);
  if (url.pathname.startsWith('/api/pokemon/')) {
    const id=decodeURIComponent(url.pathname.split('/').at(-1));
    if (failedIds.includes(id)) return send(null,503);
    return byId.has(id) ? send(detail(id)) : send(null,404);
  }
  if (url.pathname === '/api/meta/singles' && ready) return send({items:[{...summary('pokemon:25'),rank:1,images:null,groups:[{category:'move',items:[{name:'Thunderbolt',nameKo:'10만볼트',names:{ko:'10만볼트',en:'Thunderbolt',ja:'１０まんボルト',zh:'十万伏特'},rank:1,percentage:50}]}]}],season:'SSR fixture',dataDate:'2026-10-29',collectedAt:'2026-10-29T00:00:00Z',providerGeneratedAt:null,stale:false,sourceUrl:'https://example.com/source',termsUrl:'https://example.com/terms',attribution:'Synthetic SSR fixture',nameSources:[],nameLicenceUrl:null});
  return send(null,503);
});
server.listen(Number(process.env.FIXTURE_API_PORT ?? 5198), process.env.FIXTURE_API_HOST ?? '127.0.0.1', () => console.log('Synthetic SSR fixture API ready'));
