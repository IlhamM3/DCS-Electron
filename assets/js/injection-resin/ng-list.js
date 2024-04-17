const { timers } = require("jquery");

const __basedir = process.cwd();
const ui = require(__basedir + "/assets/js/lib/__ui.js");
const helper = require(__basedir + "/class/helper.class.js");

ui.ready(async function () {
  const wrapperNgList = document.querySelector(".wrapper-content-nglist");
  const btnBack = document.querySelector("#btn-back-nglist");
  const btnConfirm = document.querySelector("#btn-confirm-nglist");
  const ngitemButton = document.querySelectorAll(".box-ngList");

  const renderNgLst = (selector, items) => {
    // console.log(items[0]);
    if (items[0]) {
      try {
        selector.innerHTML = "";
        items.map((item) => {
          selector.innerHTML += `<button class="box-ngList selectable" id="${
            item.id
          }">
                ${item.name.toUpperCase()}
          </button>`;
        });
      } catch (error) {
        console.error(error);
      }
    } else {
      selector.innerHTML = `<h3 class="empty-ngList">List NG Belum ada</h3>`;
    }
  };

  let allScrap;
  let selectedItem = "";
  const NGList = () => {
    gEvents.on("NGlists", (data) => {
      allScrap = data;
      renderNgLst(wrapperNgList, allScrap);
    });
  };

  await NGList();

  const delClassActive = () => {
    [...ngitemButton].map((element) => {
      element.classList.remove("active");
    });
  };

  wrapperNgList.addEventListener("click", (e) => {
    const item = e.target;
    if (item.classList.contains("box-ngList")) {
      if (!item.classList.contains("active")) {
        const children = [...item.parentElement.children];
        children.map((element) => element.classList.remove("active"));
        item.classList.add("active");
        selectedItem = allScrap.filter((ng) => {
          return ng.id === Number(item.id);
        })[0];
      } else if (item.classList.contains("active")) {
        const children = [...item.parentElement.children];
        children.map((element) => element.classList.remove("active"));
        item.classList.remove("active");
        selectedItem = "";
      }
    }
  });
  //   end add event click when click dandori menu

  btnBack.addEventListener("click", () => {
    ui.showSpinner();
    delClassActive();
    selectedItem = "";
    ui.showPopup(false);
    ui.showSpinner(false);
  });

  btnConfirm.addEventListener("click", async () => {
    if (selectedItem.length === 0) {
      ui.showNotification("Silahkan Pilih NG dahulu", "danger", 5000);
    } else {
      ui.showSpinner();
      shift.production.incNG(selectedItem.id);
      await api.saveScrap(
        shift.details.id,
        selectedItem.id,
        shift.production.kanban.queueId,
        shift.production.kanban.part.id
      );
      delClassActive();
      selectedItem = "";
      ui.showPopup(false);
      ui.showSpinner(false);
    }
  });
});
