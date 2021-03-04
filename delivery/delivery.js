const {assign} = Object;

async function init(){
    const res = await fetch('../cities.json');
    const cities = await res.json();
    // const cities = CITIES;
    const cities_datasrc = [];
    for (const id in cities)
        cities_datasrc.push({label: cities[id], value: id});
    const ac = new Autocomplete(document.getElementById('city'), {
        data: cities_datasrc,
        maximumItems: 10,
        treshold: 1,
        onSelectItem: select_city,
    });
    $('.result').delegate('.nav-link', 'click', function(){
        const el = $(this);
        const menu_code = el.data('menu');
        const sub_menu_code = el.data('sub-menu');
        select_menu(menu_code, sub_menu_code);
    });
    $('#copy').click(copy_result);
    $('#clear').click(function(){
        $('#menu').empty();
        $('#sub_menu').empty();
        $('#city').val('');
        empty_result();
        city_items = [];
    });
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
    try {
        // const data = {routes: ROUTES};
        const data = await load_data(value);
        if (!data)
            throw new Error(`no data for city id ${value}`);
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
    } catch(e){ set_result('Error: '+e); }
}

function make_menu(){
    let html = '';
    for (const code in menu)
    {
        const item = menu[code];
        html += '<li class="nav-item">'
            +`<a class="nav-link" data-menu="${code}">`
            +`${item.label} ${item.count}</a>`
            +'</li>';
    }
    $('#menu').html(html);
    html = '';
    for (const code in sub_menu)
    {
        const item = sub_menu[code];
        html += '<li class="nav-item">'
            +`<a class="nav-link" data-menu="${item.parent_code}" `
            +`data-sub-menu="${item.code}">${item.label} ${item.count}</a>`
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
    set_result(render_result_html(menu_code, sub_menu_code));
}

const format = d=>{
    d = ''+d;
    return d.length<2 ? '0'+d : d;
};

function get_items(menu_code, sub_menu_code){
    if (!city_items)
        return [];
    return menu_code=='all' ? city_items : city_items.filter(item=>{
        if (item.menu!=menu_code)
            return false;
        if (sub_menu_code && sub_menu_code!='all'
            && item.sub_menu!=sub_menu_code)
        {
            return false;
        }
        return true;
    });
}

function get_item_data(item){
    const days = (+item.days||0)+3;
    const d = new Date();
    d.setDate(d.getDate()+days);
    const day = d.getDate();
    const month = d.getMonth()+1;
    const year = (''+d.getFullYear()).substr(2);
    const date = format(day)+'.'+format(month)+'.'+format(year);
    let address = item.address||item.name||'';
    address = (''+address).replace(/&nbsp;/g, ' ');
    let price = item.print_price||'';
    price = (''+price).replace(/&nbsp;/g, '');
    return {address, date, price};
}

function render_result_html(menu_code, sub_menu_code){
    let html = '<table class="table table-sm table-striped">';
    html += get_items(menu_code, sub_menu_code).map((item, i)=>{
        let {address, date, price} = get_item_data(item);
        price = price.replace(' руб.', '₽');
        return `<tr><td>${i+1}</td><td>${address}</td>`
            +`<td>${date}</td><td>${price}</td></tr>`;
    }).join('');
    html += '</table>';
    return html;
}

function render_result_text(menu_code, sub_menu_code){
    return get_items(menu_code, sub_menu_code).map((item, i)=>{
        const {address, date, price} = get_item_data(item);
        return (i+1)+') '+address+' '+date+', '+price;
    }).join('\n');
}

async function load_data(id){
    const res = await restdb_query('city', {id});
    return res && res[0];
}

function set_result(html){
    $('#result').html(html);
}

function empty_result(){
    $('#result').empty();
}

function copy_result(){
    const input = document.createElement('textarea');
    input.value = render_result_text(active_menu_code, active_sub_menu_code);
    document.body.appendChild(input);
    input.select();
    document.execCommand('Copy');
    input.remove();
    const copy_btn =  document.getElementById('copy');
    const tooltip = new bootstrap.Tooltip(copy_btn,
        {title: 'Copied'});
    tooltip.show();
    setTimeout(()=>tooltip.dispose(), 400);
}

$(document).ready(init);