const RESTDB_API_KEY = '603fe66aacc40f765fede3a8';
const RESTDB_BASE_URL = 'https://parklon-d6c5.restdb.io/rest/';
const PARKLON_AJAX_URL = 'https://parklon.ru/local/components/dial/regions/'
    +'ajax.php';

async function parklon_ajax(data){
    const fd = new FormData();
    for (const k in data)
        fd.append(k, data[k]);
    const res = await fetch(PARKLON_AJAX_URL, {
        method: 'POST',
        body: fd,
    });
	return await res.json();
};

async function load_city(id, name){
    const res = await parklon_ajax({ACTION: 'CHANGE', ID: ''+id});
	let html = await fetch('https://parklon.ru/personal/order/make/');
	html = await html.text();
	if (name && !html.includes(name))
	    throw new Error('');
	const start_token = 'var JSCustomOrderAjaxArea = new JSCustomOrderAjax'
            +'(';
	html = html.substr(html.indexOf(start_token)+start_token.length);
	const end_token = 'JSCustomOrderAjaxArea.init()';
	html = html.substr(0, html.indexOf(end_token));
	html = html.trim();
	html = html.substr(0, html.length-2);
	return (new Function('return '+html))();
}

const timeout = ms=>new Promise(resolve=>setTimeout(resolve, ms));

async function restdb_req(path, method, body){
    const res = await fetch(RESTDB_BASE_URL+path, {
        method: method||'GET',
        headers: {
            'x-apikey': RESTDB_API_KEY,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        body,
    });
    return await res.json();
}

async function restdb_update(collection, id, data){
    return await restdb_req(collection+'/'+id, 'PUT', JSON.stringify(data));
}

async function restdb_add(collection, data){
    return await restdb_req(collection, 'POST', JSON.stringify(data));
}

async function restdb_delete(collection, id){
    return await restdb_req(collection+'/'+id, 'DELETE');
}

async function restdb_get_all(collection){
    return await restdb_req(collection);
}

async function restdb_get_one(collection, id){
    return await restdb_req(collection+'/'+id);
}

async function restdb_query(collection, query){
    return await restdb_req(collection+'?q='+JSON.stringify(query));
}

async function restdb_update_or_add(collection, query, data){
    const res = await restdb_query(collection, query);
    if (res && res.length)
        await restdb_update(collection, res[0]._id, data);
    else
        await restdb_add(collection, data);
}

async function get_conf(name){
    const res = await restdb_query('conf', {name});
    return res && res[0] && res[0].value;
}

async function set_conf(name, value){
	await restdb_update_or_add('conf', {name}, {name, value});
}

async function load_cities(from){
    const start = Date.now();
	const cities = await get_conf('cities');
	console.log(cities);
    const len = Object.keys(cities).length;
    let i = 0, total_size = 0;
    for (const id in cities)
    {
        i++;
        if (i<from)
            continue;
        console.log(`${i}/${len}`, cities[id], id);
        try {
            const res = await load_city(id);
            const data = {id, name: cities[id], ts: Date.now(),
                routes: res.SaleResult.MARSHROUTE};
			await restdb_update_or_add('city', {id}, data);
            const dur = +((Date.now()-start)/1000).toFixed();
            const size = JSON.stringify(data).length;
            total_size += size;
            console.log('OK', '+'+size+'b', (total_size/1000).toFixed()+'kb',
                dur+'s');
        } catch(e){ console.log('ERROR', e); }
        await timeout(100);
        console.log('');
    }
    let dur = +((Date.now()-start)/1000).toFixed();
    console.log(dur+'s');
};

async function save_cities(cities){
    await set_conf('cities', cities);
}
