// document representa todo el HTML
// querySelector('header') busca el primer elemento en el html que coincida con el selector css, es decir busca la etiqueta <header>
// En "cons theader"  se guarda el elemento encontradi en la variable header
const header = document.querySelector('header');

// window es la ventana del navegador
// el .addEventListener('scroll') le indica a window que "este escuchando cuando ocurra un evento scroll (mueva la rueda del mouse, swipe, etc)"
//  () => {} es la forma corta de escribir una funcion en Js moderno, y basicamente dice que se ejecute cada vez que haya un evento scroll, es decir cientos de veces mientras se este bajando la pag
//() => {}    ES LO MISMO     function()
window.addEventListener('scroll', () => {
    // si el usuario baja 50px activa el scrolled (el cual esta puesto en css con .scrolled)
    if (window.scrollY > 50)  
    {
        // es equivalente a que en el html pongamos <header class="scrolled">
        header.classList.add('scrolled');
    }
    // si no se cumple se desactiva, dejandolo como estaba originalmente
    else
    {
        header.classList.remove('scrolled');
    }
});


const menuBtn = document.getElementById('menubtn')
const menuDesplegable = document.getElementById('menuDesplegable')
const overlay = document.getElementById('overlay')

menuBtn.addEventListener('click', function() {
    // el toggle('clase') revisa si la clase ya esta en el elemento, si no la esta la agrega
    menuDesplegable.classList.toggle('abierto');
    overlay.classList.toggle('activo');
})

const exitBtn = document.getElementById('cerrarMenu')

exitBtn.addEventListener('click', function() {
    // el remove('clase') se encarga de quitar la clase sin importar si estaba o no
    menuDesplegable.classList.remove('abierto');
    overlay.classList.remove('activo');
})

document.addEventListener('click', function(event){

    // event.target es el elemento del HTML donde ocurrio el click, ejemplo si hago click en THE OUTFIT seria h1
    // contains responde la pregunta "¿el elemento donde di click  (event.target) esta dentro de otro elemento (menuDesplegable), ya sea directamente o dentro de alguno de sus hijos?"
    // devuelve true o false, si hago click en el menu devuelve true, si es fuera del menu es false
    const  clickDentroDelMenu = menuDesplegable.contains(event.target);
    const clickEnBotonMenu = menuBtn.contains(event.target);

    if (!clickDentroDelMenu && !clickEnBotonMenu) {
        // aqui especificamos que si el click fue fuera del menu remueve la clase que abria el menu
        menuDesplegable.classList.remove('abierto');
        overlay.classList.remove('activo');
    }
})
