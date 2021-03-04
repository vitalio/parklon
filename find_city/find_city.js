const {assign} = Object;

async function init(){
    const res = await fetch('../cities.json');
    cities = await res.json();
    const cities_datasrc = [];
    for (const id in cities)
        cities_datasrc.push({label: cities[id], value: id});
    const ac = new Autocomplete(document.getElementById('city'), {
        data: cities_datasrc,
        maximumItems: 10,
        treshold: 2,
        onSelectItem: select_city,
    });
    $('.result').delegate('.nav-link', 'click', function(){
        const el = $(this);
        const menu_code = el.data('menu');
        const sub_menu_code = el.data('sub-menu');
        select_menu(menu_code, sub_menu_code);
    });
    $('#copy').click(copy_result);
}

let menu, sub_menu, active_menu_code, active_sub_menu_code, city_items;

async function select_city({label, value}){
    city_items = [];
    menu = {all: {label: 'Все', code: 'all', count: 0}};
    sub_menu = {};
    console.log('selected city', label, value);
    if (!value)
        return;
    set_result('Loading...');
    const res = await load_data(value);
    const data = res && res[0] || {};
    const {routes} = data;
    if (routes.COURIER && routes.COURIER.length)
    {
        menu.courier = {label: 'Курьер', code: 'courier', count: 0};
        routes.COURIER.forEach(item=>{
            city_items.push(assign(item, {menu: 'courier'}));
            menu.all.count++;
            menu.courier.count++;
        });
    }
    if (routes.PVZ_ALL && routes.PVZ_ALL.length)
    {
        menu.pvz = {label: 'Самовывоз', code: 'pvz', count: 0,
            sub_menu: true};
        sub_menu.all = {label: 'Все', code: 'all', parent_code: 'pvz',
            count: 0};
        routes.PVZ_ALL.forEach(item=>{
            menu.all.count++;
            menu.pvz.count++;
            sub_menu.all.count++;
            const code = item.delivery_code;
            city_items.push(assign(item, {menu: 'pvz', sub_menu: code}));
            if (sub_menu[code])
                return sub_menu[code].count++;
            const label = item.name.substr(10);
            sub_menu[code] = {label, code, count: 1, parent_code: 'pvz'};
        });
    }
    make_menu();
    select_menu('all');
    copy_result();
}

function make_menu(){
    let html = '';
    for (const code in menu)
    {
        const item = menu[code];
        html += '<li class="nav-item">'
            +`<a class="nav-link" data-menu="${code}">`
            +`${item.label} (${item.count})</a>`
            +'</li>';
    }
    $('#menu').html(html);
    html = '';
    for (const code in sub_menu)
    {
        const item = sub_menu[code];
        html += '<li class="nav-item">'
            +`<a class="nav-link" data-menu="${item.parent_code}" `
            +`data-sub-menu="${item.code}">${item.label} (${item.count})</a>`
            +'</li>';
    }
    $('#sub_menu').html(html);
}

function select_menu(menu_code, sub_menu_code){
    console.log('select menu', menu_code, sub_menu_code);
    const active_menu = menu[menu_code];
    if (active_menu.sub_menu && !sub_menu_code)
        sub_menu_code = 'all';
    const active_sub_menu = sub_menu[sub_menu_code];
    if (active_menu && active_menu.sub_menu)
        $('#sub_menu').show();
    else
        $('#sub_menu').hide();
    if (active_menu_code)
    {
        $(`#menu .nav-link[data-menu=${active_menu_code}]`)
            .removeClass('active');
    }
    $(`#menu .nav-link[data-menu=${menu_code}]`).addClass('active');
    if (active_sub_menu_code)
    {
        $(`#sub_menu .nav-link[data-sub-menu=${active_sub_menu_code}]`)
            .removeClass('active');
    }
    if (sub_menu_code)
    {
        $(`#sub_menu .nav-link[data-sub-menu=${sub_menu_code}]`)
            .addClass('active');
    }
    active_menu_code = menu_code;
    active_sub_menu_code = sub_menu_code;
    render_result(menu_code, sub_menu_code);
}

const format = d=>{
    d = ''+d;
    return d.length<2 ? '0'+d : d;
};
function render_result(menu_code, sub_menu_code){
    if (!city_items)
        return;
    const items = menu_code=='all' ? city_items : city_items.filter(item=>{
        if (item.menu!=menu_code)
            return false;
        if (sub_menu_code && sub_menu_code!='all'
            && item.sub_menu!=sub_menu_code)
        {
            return false;
        }
        return true;
    });
    set_result(items.map(item=>{
        const days = +item.days||0;
        const d = new Date();
        d.setDate(d.getDate()+days);
        const day = d.getDate();
        const month = d.getMonth()+1;
        const year = d.getFullYear();
        const date = format(day)+'.'+format(month)+'.'+format(year);
        return (item.address||item.name)+' '+date+' '+item.print_price;
    }).join('\n'));
}

async function load_data(id){
    const res = await restdb_query('city', {id});
    const data = res && res[0];
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