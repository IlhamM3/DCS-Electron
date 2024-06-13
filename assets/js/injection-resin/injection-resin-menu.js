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
      event.preventDefault();
      SensorBaru.style.backgroundColor = '#3bbfee';
      SensorLama.style.backgroundColor = '#fff';
      PCSsensor.style.backgroundColor = '#3bbfee';
      PCSsensor.style.fontWeight = 'bold';
      PCSsensor.innerHTML = `<span class="shift-pcs-ok-new">0</span>&nbsp;Pcs `;
      
      setInterval(() => {
        this.total_produksi = this.datacycle * this.qty_product;
        this.total_pcs = this.total_produksi || 0;
        $(".shift-pcs-ok-new").html(this.total_pcs || 0);
        // console.log(this.total_pcs)
        // console.log(this.total_produksi)
        // console.log(this.datacycle)
      });
    
    });

    gEvents.on("datacycle", (data) =>{
      this.datacycle = data[0].cycle
      console.log(this.datacycle)
    });
    gEvents.on("databaterai", (Data) => {
      const data = Data ?? 'Modul OFF'
      if (data === 'Modul OFF') {
          $("#indikator_baterai").html(data)
      } else {
        const intervalId = setInterval(() => {
            const timedata = data[0].updatedAt;
            const lastReceivedDataTime = new Date(timedata).getTime();
            const currentTime = new Date().getTime();
            if (currentTime - lastReceivedDataTime > 65000) {
              $("#indikator_baterai").html('Modul OFF')
              clearInterval(intervalId);
            } else {
              const databaterai = data[0].battery_indicator;
              $("#indikator_baterai").html(databaterai + '%');
            }
        }); // Menjalankan interval setiap 1 detik (1000 ms)
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
      this.qty_product = selectedQueue.part.qty_per_kbn;
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
