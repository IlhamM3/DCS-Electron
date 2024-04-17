const __basedir = process.cwd();
const ui = require(__basedir + "/assets/js/lib/__ui");

/***************** Dashboard-kanban ************************/
ui.ready(async function () {
  // slider
  const slider_kanban_menu = document.querySelector("#slider-kanban-menu");
  let dataSlides;

  /**
   * Render slide from data API, data partList from index js
   * */
  const getSlides = () => {
    gEvents.on("queueInject", (data) => {
      dataSlides = data.data;
    });
  };
  await getSlides();

  // end  slider
  // click event on slider kanban
  let selectedQueue = [];
  slider_kanban_menu.addEventListener("click", (e) => {
    // console.log(e.target.parentElement);
    itemCard = e.target.parentElement;
    slidesElement = [...itemCard.parentElement.children];
    // console.log(slidesElement);
    const id = itemCard.id;
    if (
      itemCard.classList.contains("card-tap") &&
      !itemCard.classList.contains("done")
    ) {
      ui.showSpinner();
      slidesElement.map((slide) => slide.classList.remove("active"));
      itemCard.classList.add("active");
      selectedQueue = dataSlides.filter((list) => {
        return list.id === Number(id);
      })[0];
      const tmp = dataSlides.length - 1;
      const lastKanbanId = dataSlides[tmp].id;
      gEvents.emit("selectedQueue", { selectedQueue, lastKanbanId });
      ui.showSpinner(false);
      ui.showSection("part-info");
    } else if (
      itemCard.classList.contains("card-tap") &&
      itemCard.classList.contains("done")
    ) {
      ui.showNotification("Queue Sudah Selesai", "danger", 3000);
    }
  });
  // end click event on slider kanban
});
