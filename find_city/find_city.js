let cities;

async function init(){
    const res = await fetch('../cities.json');
    cities = await res.json();
    const cities_datasrc = [];
    for (const id in cities)
        cities_datasrc.push({label: cities[id], value: id});
    const ac = new Autocomplete(document.getElementById('city'), {
        data: cities_datasrc,
        maximumItems: 10,
        treshold: 1,
        onSelectItem: select_city,
    });
}

async function select_city({label, id}){
    console.log('user selected:', label, value);
    const data = await load_data(value);
    // set_result(`Label: ${label}\nValue: ${value}\nDate: ${Date.now()}`);
    copy_result();
}

async function load_data(id){
    const res = await restdb_query('city', {id});
    const data = res && res[0];
    console.log(JSON.stringify(data));
}

function set_result(text){
    $('#result').text(text);
}

function copy_result(){
    const copy_text = document.getElementById('result');
    const input = document.createElement('textarea');
    input.value = copy_text.textContent;
    document.body.appendChild(input);
    input.select();
    document.execCommand('Copy');
    input.remove();
}

$(document).ready(init);