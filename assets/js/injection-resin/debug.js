const ui = require(__basedir + "/assets/js/lib/__ui.js");
const display = require(__basedir + "/assets/js/lib/__display.js");

const config = require(__basedir + "/config/app.config.js");

const object = {
  employeeId: ["2000", "3000", "3000"],
};

async function init(RFIDLogin) {
  if (!config.debug) {
    return null;
  }

  ui.ready(function () {
    const rfidLogo = document.querySelector(".rfid.image-rfid");
    rfidLogo.addEventListener("click", function () {
      RFIDLogin({ data: { id: object.employeeId[0] } });
    });

    const scwMaintenance = document.querySelector(".scw-maintenance");
    scwMaintenance.addEventListener("click", function () {
      RFIDLogin({ data: { id: object.employeeId[2] } });
    });

    const writeRfidPengawas = document.querySelector(
      ".scan-id-input-write-rfid"
    );
    writeRfidPengawas.addEventListener("click", function () {
      RFIDLogin({ data: { id: object.employeeId[1] } });
    });

    const breakButton = document.querySelector("#stop-timer-shift-break");
    breakButton.addEventListener("click", function () {
      RFIDLogin({ data: { id: object.employeeId[0] } });
    });

    const dandoriStopTimer = document.querySelector("#dandori-stop-timer");
    dandoriStopTimer.addEventListener("click", function () {
      RFIDLogin({ data: { id: object.employeeId[1] } });
    });

    const dandorimScw = document.querySelector(".dandori-maintenance");
    dandorimScw.addEventListener("click", function () {
      RFIDLogin({ data: { id: object.employeeId[2] } });
    });

    $(".auth-confirm-debug").on("click", function () {
      const element = $(".auth-confirm-debug");
      let innerText = "";
      if (element[0].innerText) {
        innerText = element[0].innerText;
      } else {
        innerText = element[1].innerText;
      }
      switch (innerText) {
        case "LEADER":
          RFIDLogin({ data: { id: object.employeeId[1] } });
          break;
        case "MAINTENANCE":
          RFIDLogin({ data: { id: object.employeeId[2] } });
          break;
        case "OPERATOR":
          RFIDLogin({ data: { id: object.employeeId[1] } });
          break;
        default:
          break;
      }
    });
    $(".auth-confirm-debug-two").on("click", function () {
      RFIDLogin({ data: { id: object.employeeId[1] } });
    });

    // debug scan pengawas
    $("#scan-pengawas-pop").on("click", function () {
      RFIDLogin({ data: { id: object.employeeId[1] } });
    });
  });
}

module.exports = init;
