const __basedir = process.cwd();
const ui = require(__basedir + "/assets/js/lib/__ui");
const config = require(__basedir + "/config/app.config");

/***************** Part-Info ************************/
ui.ready(function () {
  const partNameMain = document.querySelector("#part-name-main");
  const partNoMain = document.querySelector("#part-no-main");
  // const partInfoKanban = document.querySelector("#part-detail-kanban-ds");
  const partImageMain = document.querySelector("#part-img-main-menu");
  const partQtyKbn = document.querySelector(".shift-qty-per-kanban");
  // const partCustomerMain = document.querySelector("#part-customer-main");
  partNameMain.innerText = "";
  partNoMain.innerText = "";
  const getSelectedQueueMain = () => {
    gEvents.on("selectedQueue", (data) => {
      const { selectedQueue } = data;
      partNameMain.innerText = selectedQueue.part?.name;
      partNoMain.innerText = selectedQueue.part?.number;
      if (selectedQueue?.part?.number === null) {
        partNoMain.innerText = `-`;
      }
      partQtyKbn.innerText = selectedQueue.part?.qty_per_kbn;
      // partInfoKanban.innerHTML = `${selectedQueue?.part?.number}<br>${selectedQueue?.part?.name}</$>`;
      // if(selectedQueue?.part?.number === null){
      //     partNoMain.innerText = `-`;
      //     partInfoKanban.innerHTML = `</$>-<br>${selectedQueue?.part?.name}</$>`;
      // }
      partImageMain.innerHTML = `<img
                class="image-part-IRM"
                style="margin-top: 0px"
                src="${selectedQueue?.part?.image}"
                alt="${selectedQueue?.part?.name}"
              />
              `;
    });
  };
  getSelectedQueueMain();
});
