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

menuBtn.addEventListener('click', function() {
    menuDesplegable.classList.toggle('abierto');
})