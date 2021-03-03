const JSONBIN_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IkFDZGUxZ3Q5SXpIIiwicGF0aCI6InBhcmtsb24iLCJpYXQiOjE2MTQ3OTY1NzMsImV4cCI6MjQ3ODc5NjU3M30.7NWmTWAi2olBN-0fBQGE5Eal7i-dJ12Hj1pEI9pp3ag';
const JSONBIN_BASE_URL = 'https://jsonbin.org/vitalio/parklon/';
const PARKLON_AJAX_URL = 'https://parklon.ru/local/components/dial/regions/ajax.php';

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
	const start_token = 'var JSCustomOrderAjaxArea = new JSCustomOrderAjax(';
	html = html.substr(html.indexOf(start_token)+start_token.length);
	const end_token = 'JSCustomOrderAjaxArea.init()';
	html = html.substr(0, html.indexOf(end_token));
	html = html.trim();
	html = html.substr(0, html.length-2);
	return (new Function('return '+html))();
}

const timeout = ms=>new Promise(resolve=>setTimeout(resolve, ms));

async function jsonbin_req(path, method, body){
    return await fetch(JSONBIN_BASE_URL+path, {method: method||'GET',
		headers: {authorization: 'Bearer '+JSONBIN_TOKEN},
		body,
	});
}

async function jsonbin_save(path, data){
    return await jsonbin_req(path, 'POST', JSON.stringify(data));
}

async function jsonbin_make_public(path){
    return await jsonbin_req(path+'/_perms', 'PUT');
}

async function jsonbin_get_public(path){
    const res = await fetch(JSONBIN_BASE_URL+path);
	return await res.json();
}

async function load_cities(){
    const start = Date.now();
	const cities = await jsonbin_get_public('cities');
	console.log(cities);
    const len = Object.keys(cities).length;
    let i = 0, total_size = 0;
    for (const id in cities)
    {
        i++;
	    console.log(`${i}/${len}`, cities[id], id);
		try {
            const res = await load_city(id);
		    const data = res.SaleResult.MARSHROUTE;
			data.city = {id, name: cities[id]}
			const dur = +((Date.now()-start)/1000).toFixed();
			const size = JSON.stringify(data).length;
			total_size += size;
			console.log('OK', '+'+size+'b', (total_size/1000).toFixed()+'kb',
			    dur+'s');
			await jsonbin_save('city/'+id, data);
			await jsonbin_make_public('city/'+id);
		} catch(e){ console.log('ERROR', e); }
		await timeout(100);
		console.log('');
	}
	let dur = +((Date.now()-start)/1000).toFixed();
	console.log(dur+'s');
};

await load_cities();