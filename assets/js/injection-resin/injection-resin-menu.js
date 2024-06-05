const __basedir = process.cwd();
const ui = require(__basedir + "/assets/js/lib/__ui");
const config = require(__basedir + "/config/app.config"); 
/***************** Part-Info ************************/
ui.ready(function () {
  //logic adding new feature
  const IndikatorBaterai = document.getElementById('indikator_baterai');
  const SensorLama = document.getElementById('sensorlama');
  const SensorBaru = document.getElementById('sensorbaru');
  const PCSsensor = document.getElementById('PCSsensor');

  const newFeatureData = () => {
    SensorLama.addEventListener('click', (event) => {
        event.preventDefault();
        SensorLama.style.backgroundColor = '#3bbfee';
        SensorBaru.style.backgroundColor = '#fff';
        PCSsensor.innerHTML = '<span class="shift-pcs-ok">0</span>&nbsp;Pcs';
        PCSsensor.style.backgroundColor = '#fff';
        PCSsensor.style.fontWeight = 'normal';
    });

    SensorBaru.addEventListener('click', (event) => {
      total_pcs = this.total_produksi ?? 0;
      event.preventDefault();
      SensorBaru.style.backgroundColor = '#3bbfee';
      SensorLama.style.backgroundColor = '#fff';
      PCSsensor.innerHTML = `<span class="shift-pcs-ok-new">${total_pcs}</span>&nbsp;Pcs `;
      PCSsensor.style.backgroundColor = '#3bbfee';
      PCSsensor.style.fontWeight = 'bold';
  
      const datacycleElements = document.getElementsByClassName('shift-pcs-ok-new');
      
      gEvents.on("datacycle", (data) => {
          if (data === 'Proximity is off') {
              for (let element of datacycleElements) {
                  element.innerText = 0;
              }
              console.log(data);
          } else {
              if (data && data.length > 0) {
                  const cycle = data[0].cycle;
                  const total_produksi = cycle * this.qty_produksi; // Use qty_produksi directly
                  this.total_produksi = total_produksi
                  for (let element of datacycleElements) {
                      element.innerText = total_produksi;
                  }
              } else {
                  console.error("Invalid datacycle data:", data);
              }
          }
      });
  });

    
    gEvents.on("databaterai", (data) => {
      if (data === 'Battery is off') {
        IndikatorBaterai.innerHTML = '<span>Modul OFF</span>'
      } else {
          const databaterai = data[0].battery_indicator;
          IndikatorBaterai.innerText = `${databaterai}%`
      }
  });
};

newFeatureData();
  //End adding new feature

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
      this.qty_produksi = selectedQueue.part.qty_per_kbn;
      console.log(selectedQueue)
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
  newFeatureData();
  getSelectedQueueMain();
});
