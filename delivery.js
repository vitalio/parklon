/*jshint esversion: 8*/
import api from "./api.js";

const DAYS_ADD = 3;
const {assign} = Object;
let conf;

const custom_fetch = api.init_fetch(fetch);

const fetch_json = async (url, opt)=>await custom_fetch(url,
    assign(opt, {output: 'json'}));

class RestDBInstance extends api.BaseRestDBInstance {
    async fetch_json(url, opt){
        return await fetch_json(url, opt);
    }
}

class Scrapper extends api.BaseScrapper {
    constructor(fetch_api){
        this.parse_html = Range.prototype.createContextualFragment.bind(
            document.createRange())
        super(fetch_api);
    }
    parse(data){
        return {$, parsed: $.parseHTML(data)};
        // this.parse_html(data);
    }
    select(parsed, selector){
        parsed.find(selector);
    }
}

const restdb = new api.RestDB(RestDBInstance);

async function init(){
    try {
        const config = new api.Conf(restdb);
        conf = window.CONF || await config.get_all();
        conf.type2products = api.get_products_by_type(conf.products);
        console.log('conf', conf);
        const cities_datasrc = [];
        for (const id in conf.cities)
            cities_datasrc.push({label: conf.cities[id], value: id});
        const ac = new Autocomplete(document.getElementById('city'), {
            data: cities_datasrc,
            maximumItems: 10,
            treshold: 1,
            onSelectItem: select_city,
        });
        init_catalog();
        $('main .result').delegate('.nav-link', 'click', function(){
            const el = $(this);
            const menu_code = el.data('menu');
            const sub_menu_code = el.data('sub-menu');
            select_menu(menu_code, sub_menu_code);
        });
        $('main').delegate('#copy', 'click', copy_result);
        $('main').delegate('#clear', 'click', deselect_city);
        $('main').show();
        if (active_type)
            select_type(active_type);
        else
            deselect_type();
        $('#loading').hide();

        const scrapper = new Scrapper();
        const sync = new api.Sync(scrapper, restdb);
        await sync.sync_delivery();
    } catch(e){
        set_fatal_error(e);
    }
}

const set_fatal_error = e=>{
    console.error(e);
    $('#error').text(e);
    $('#loading, main').hide();
};

const init_catalog = ()=>{
    let html = '<div class="list-group">';
    for (const type in conf.type2products)
    {
        const prod = conf.type2products[type][0];
        const titles = conf.type2products[type].map(p=>p.title).join(', ');
        html += '<a class="list-group-item list-group-item-action" '
            +`data-type="${type}">`
            +'<div class="d-flex w-100 justify-content-between">'
            +`<h5 class="mb-1">${type}</h5>`
            +`<small>${prod.price}</small>`
            +'</div>'
            +`<small>${titles}</small>`
            +'</a>';
    }
    html += '</div>';
    $('#catalog').html(html);
    $('#catalog').delegate('a.list-group-item', 'click', function(){
        const el = $(this);
        const type = el.data('type');
        if (type==active_type)
            return deselect_type();
        select_type(type);
    });
};

const deselect_type = ()=>{
    $('#catalog a.list-group-item').removeClass('active').show();
    $('#delivery').hide();
    active_type = null;
    deselect_city();
};

const select_type = type=>{
    $('#catalog a.list-group-item').removeClass('active');
    $(`#catalog a.list-group-item[data-type="${type}"]`).addClass('active');
    $('#catalog a.list-group-item').not('.active').hide();
    $('#delivery').show();
    active_type = type;
};

let active_type = '200x140 см,1 см,PE';
let menu, sub_menu, active_menu_code, active_sub_menu_code, city_items;

const deselect_city = ()=>{
    $('#menu').empty();
    $('#sub_menu').empty();
    $('#city').val('');
    empty_result();
    city_items = [];
};

async function select_city({label, value}){
    city_items = [];
    menu = {all: {label: 'Все', code: 'all', count: 0}};
    sub_menu = {};
    console.log('selected city', label, value);
    if (!value)
        return;
    set_result('Loading...');
    try {
        const data = window.ROUTES ? {routes: window.ROUTES}
            : (await load_data(value));
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
                const {code} = item;
                city_items.push(assign(item, {menu: 'pvz', sub_menu: code}));
                if (sub_menu[code])
                    return sub_menu[code].count++;
                const label = item.name.substr(10);
                sub_menu[code] = {label, code, count: 1, parent_code: 'pvz'};
            });
        }
        render_menu();
        select_menu('all');
    } catch(e){ set_result(e); }
}

const render_menu = ()=>{
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
};

const select_menu = (menu_code, sub_menu_code)=>{
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
        $(`#menu .nav-link[data-menu="${active_menu_code}"]`)
            .removeClass('active');
    }
    $(`#menu .nav-link[data-menu="${menu_code}"]`).addClass('active');
    if (active_sub_menu_code)
    {
        $(`#sub_menu .nav-link[data-sub-menu="${active_sub_menu_code}"]`)
            .removeClass('active');
    }
    if (sub_menu_code)
    {
        $(`#sub_menu .nav-link[data-sub-menu="${sub_menu_code}"]`)
            .addClass('active');
    }
    active_menu_code = menu_code;
    active_sub_menu_code = sub_menu_code;
    set_result(render_result_html(menu_code, sub_menu_code));
};

const format = d=>{
    d = ''+d;
    return d.length<2 ? '0'+d : d;
};

const get_items = (menu_code, sub_menu_code)=>{
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
};

const get_item_data = item=>{
    const days = (+item.days||0)+DAYS_ADD;
    const d = new Date();
    d.setDate(d.getDate()+days);
    const day = d.getDate();
    const month = d.getMonth()+1;
    const year = (''+d.getFullYear()).substr(2);
    const date = format(day)+'.'+format(month)+'.'+format(year);
    let address = item.address||item.name||'';
    address = (''+address).replace(/&nbsp;/g, ' ');
    const {cost} = item;
    return {address, date, cost};
};

const render_result_html = (menu_code, sub_menu_code)=>{
    let html = '<table class="table table-sm table-striped">';
    html += get_items(menu_code, sub_menu_code).map((item, i)=>{
        const {address, date, cost} = get_item_data(item);
        const price = cost ? cost+'₽' : 'бесплатно';
        return `<tr><td>${i+1}</td><td>${address}</td>`
            +`<td>${date}</td><td>${price}</td></tr>`;
    }).join('');
    html += '</table>';
    return html;
};

const render_result_text = (menu_code, sub_menu_code)=>{
    return get_items(menu_code, sub_menu_code).map((item, i)=>{
        const {address, date, cost} = get_item_data(item);
        const price = cost ? cost+' руб.' : 'бесплатно';
        return (i+1)+') '+address+' '+date+', '+price;
    }).join('\n');
};

async function load_data(id){
    const res = await restdb.get_instance_by_type(active_type).query('city',
        {id});
    return res && res[0];
}

const set_result = html=>$('#result').html(html);

const empty_result = ()=>$('#result').empty();

const copy_result = ()=>{
    const input = document.createElement('textarea');
    input.value = render_result_text(active_menu_code, active_sub_menu_code);
    document.body.appendChild(input);
    input.select();
    document.execCommand('Copy');
    input.remove();
    $('#copy').text('Copied');
    console.log('copied');
    setTimeout(()=>$('#copy').text('Copy'), 150);
};

$(document).ready(init);
