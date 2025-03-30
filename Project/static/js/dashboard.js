let btn = document.querySelector('#btn');
let sidebar = document.querySelector('.sidebar');
let searchBtn = document.querySelector('.bx-search');
const groupdropdownToggles = document.querySelector('.group-dropdown-toggle');
const groupdropdownmenu = document.querySelector('.group-dropdown-menu')

btn.addEventListener('click', () => {
  sidebar.classList.toggle('active');
});

searchBtn.addEventListener('click', () => {
  sidebar.classList.toggle('active');
});

groupdropdownToggles.addEventListener('click', () => {
  if (groupdropdownmenu.style.display === "block")
    groupdropdownmenu.style.display = "none";
  else 
    groupdropdownmenu.style.display = "block";
});