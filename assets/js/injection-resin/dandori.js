const { timers } = require("jquery");

const __basedir = process.cwd();
const ui = require(__basedir + "/assets/js/lib/__ui.js");
const helper = require(__basedir + "/class/helper.class.js");

ui.ready(async function () {
  const btnAcceptDandori = document.querySelector("#btn-accept-dandori");

  const renderDandori = (selector, items) => {
    // console.log(items[0]);
    if (items[0]) {
      try {
        selector.innerHTML = "";
        items.map((item) => {
          selector.innerHTML += `<button class="btn-action-edit-dandori-menu-pop yes" id="${item.id}">Ya
                     </button>
                     <button class="btn-action-edit-dandori-menu-pop-not">Tidak</button>`;
        });
      } catch (error) {
        console.error(error);
      }
    } else {
      selector.innerHTML = `<h3 class="empty-dandori">List Dandori Belum ada</h3>
                                    <button class="btn-action-edit-dandori-menu-pop-not-ok">OK</button>`;
    }
  };

  let dandoriLists;
  let selectedItem = "";
  //  get dandori lists from passing data index js
  const getDandoriLists = () => {
    gEvents.on("dandoriLists", (data) => {
      dandoriLists = data;
      renderDandori(btnAcceptDandori, dandoriLists);
    });
  };

  await getDandoriLists();

  const getSelecteddandori = () => {
    gEvents.on("selectedDandori", (data) => {
      selectedDandori = data;
    });
    ui.showSpinner(false);
  };

  getSelecteddandori();

  btnAcceptDandori.addEventListener("click", async (e) => {
    const item = e.target;
    if (item.classList.contains("btn-action-edit-dandori-menu-pop")) {
      selectedItem = dandoriLists.filter((list) => list.id === Number(item.id));
      const _currentDandori = {
        id: selectedItem[0].id,
        name: selectedItem[0].name,
        parent: null,
        type: selectedItem[0].type || "B",
        plan: {
          duration: helper.hmsToMs(selectedItem[0].time),
        },
      };
      console.log("_currentDandori", _currentDandori);

      shift.dandori.init(_currentDandori);

      gEvents.emit("selectedDandori", selectedItem[0]);
      ui.showPopup(false);
      $(".dandori-scw-timer").html("00:00:00.0");

      shift.dandori.start();
      ui.showSpinner(false);
      ui.showSection("dandori-details-sec");
    } else if (
      item.classList.contains("btn-action-edit-dandori-menu-pop-not")
    ) {
      ui.showPopup(false);
      ui.showSpinner(false);
    }
    if (item.classList.contains("btn-action-edit-dandori-menu-pop-not-ok")) {
      ui.showPopup(false);
      ui.showSpinner(false);
    }
  });
});
