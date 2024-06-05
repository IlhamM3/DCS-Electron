global.__basedir = process.cwd();
global.config = require(__basedir + "/config/app.config");
global.helper = require(__basedir + "/class/helper.class");

const fs = require("fs");
const fsPromises = fs.promises;
const { ipcRenderer } = require("electron");
const date = require("date-and-time");
// const _serial = require("@iqrok/serial.helper");

//const rfid = require("@iqrok/pcsclite.helper");
const ui = require(__basedir + "/assets/js/lib/__ui");
const display = require(__basedir + "/assets/js/lib/__display");
const _debugging = require(__basedir + "/assets/js/injection-resin/debug.js");
const scw = require(__basedir + "/assets/js/lib/data/__scw");
const dandori = require(__basedir + "/assets/js/lib/data/__dandori");
global.timer = require(__basedir + "/assets/js/lib/__timer");
global.shiftAuth = require(__basedir + "/assets/js/lib/data/__authorization");
global.shift = require(__basedir + "/assets/js/lib/data/__shift");
global.api = new (require(__basedir + "/assets/js/lib/api.lib.js"))(
  config,
  config.debug
);
const { renderQueue, generateNgMenu, generateSCWMenu } = require(__basedir +
  "/assets/js/injection-resin/utils");
global.resultProductRemaining;
("use strict");

const staticData = {
  ng: require(__basedir + "/config/logs/ng.example"),
  dandori: require(__basedir + "/config/logs/dandori.example"),
  // scw: require(__basedir + "/config/logs/scw.example"),
  shift: require(__basedir + "/config/logs/shift.example"),
  positions: require(__basedir + "/config/logs/positions.example"),
};

/******************* SERIAL PORT *********************/
// const serial = new _serial(config.serial, config.debug);

// serial.on("open", (received) => {
//   console.log("Serial Port is ready", received);
// });

// serial.on("data", (received) => {
//   const { data } = received;

//   // check if data is defined and shift already started
//   if (data === undefined || shift.production.startTime == null) {
//     return;
//   }

//   if (data.proximity) {
//     shift.production.incPcs(1);
//   }
// });

// serial.on("error", (received) => {
//   console.error("Serial Port error", received);
// });

/******************* RFID MIFARE *********************/
/*
// check if pcscd is available or not
if (rfid) {
  // on card inserted, run card reading
  rfid.on("ready", (protocol) => {
    const startingBlock = 4;
    rfid.readBlocksJSON(startingBlock);
  });

  // listener on blocks reading result
  rfid.on("blocks", RFIDLogin);
}
*/

// const rfid = new _serial(config.rfid, config.debug);

// rfid.on("open", (received) => {
//   console.log("Serial Port is ready", received);
// });

// rfid.on("data", (received) => {
//   const { data } = received;

//   if (data.id) {
//      RFIDLogin(received)
//   }
// });

// serial.on("error", (received) => {
//   console.error("RFID error", received);
// });

/******************* PING WRAPPER *********************/
const net = require("net");
const client = new net.Socket();

client.connect(3001, "127.0.0.1", function () {
  console.log("Connected");
});

client.on("data", function (result) {
  try {
    const {
      data: { time },
    } = JSON.parse(result.toString());

    if (time.toFixed() > 0 && time.toFixed() <= 100) {
      const status = document.getElementById("status");
      (status.className = "good"), (status.innerHTML = "Good");
    } else if (time.toFixed() > 100) {
      const status = document.getElementById("status");
      (status.className = "bad"), (status.innerHTML = "Bad");
    }
  } catch (err) {
    const status = document.getElementById("status");
    (status.className = "bad"), (status.innerHTML = "No Internet");
    console.log(result.toString());
  }
});

client.on("close", function () {
  console.log("Connection closed");
});

/******************* FUNCTIONS *********************/
global._RFIDInterval = {
  min: 3000, // 5s, change accordingly
  current: 0,
};

async function RFIDLogin(received) {
  // return immediatley if interval between tap is too short
  if (new Date() - _RFIDInterval.current < _RFIDInterval.min) {
    return {
      status: false,
    };
  }

  const { data } = received;

  if (!(data && data.id)) {
    return {
      status: false,
    };
  }
  const { data: dataRFID, status, error } = await api.verifyRFID(data.id);
  if (status) {
    const verify = shiftAuth.verifyByName(
      (dataRFID && dataRFID.position.name) || "empty"
    );

    if (verify) {
      shift.operator = dataRFID;
      // update last time RFID tapped successfully
      _RFIDInterval.current = new Date();
    }

    return verify;
  } else {
    ui.showNotification(error, "danger", 2000);
    return false;
  }
}

async function dandoriAuth() {
  shiftAuth
    .clearWaitForAuth()
    .use("dandori")
    .addRequiredByName(
      {
        name: ["leader"],
        group: 2,
      },
      true
    );

  const wait = await shiftAuth.use("dandori").waitForAuth();

  // finish dandori if only waitForAuth is not forcefully closed
  if (wait) {
    timer.use("downtime").pause();
    timer.use("dandori").stop(true);
    const dandoriSCW = timer.use("dandori-scw").getTotal();
    timer.use("dandori-scw").stop(true);
    timer.use("downtime").add(dandoriSCW);

    shift.dandori.finish();
    ui.showSpinner(false);
    ui.showSection("injection-resin-menu");

    shift.dandori.setId(dandori.insertIdBack);
  }

  return wait;
}

function bodySend_saveLog() {
  const { summary } = shift.production;
  return {
    shiftId: shift.details?.id,
    queueId: summary.kanban?.queueId,
    partId: summary.kanban?.part?.id,
    totalPcs: summary.pcs,
    totalNg: summary.ng,
    production: helper.msToHms(timer.use("production").getTotal()),
    downtime: helper.msToHms(timer.use("downtime").getTotal()),
    downtimeA: helper.msToHms(timer.use("downtimeA").getTotal()),
    break: helper.msToHms(timer.use("shift-break").getTotal()),
    queueSession: localStorage.getItem("queueSession"),
  };
}

async function listQueue() {
  // checking respon queuInject
  global.queueInject = await api.getAllQueueInject(config.machineId);
  if (queueInject.status) {
    const productRemaining = document.querySelector(".product-remaining");
    resultProductRemaining = queueInject.data.filter((obj) => {
      return obj.status === false;
    });
    productRemaining.innerText = resultProductRemaining.length;
    const statusKanban = queueInject.data
      .map((item) => item.status)
      .lastIndexOf(true);

    gEvents.emit("queueInject", queueInject);

    statusKanban > 0
      ? renderQueue(queueInject, statusKanban + 2)
      : renderQueue(queueInject, 3);

    let selectedQueue = null;
    if (queueInject.data[0].status) {
      const statusKanban = queueInject.data
        .map((item) => item.status)
        .lastIndexOf(true);
      if (queueInject.data[statusKanban + 1] === undefined) {
        const statusKanban = queueInject.data
          .map((item) => item.status)
          .lastIndexOf(false);
        if (statusKanban < 0) {
          selectedQueue = queueInject.data[0];
        } else {
          selectedQueue = queueInject.data[statusKanban];
        }
      } else {
        ui.showSpinner(false);
        selectedQueue = queueInject.data[statusKanban + 1];
      }
    } else {
      ui.showSpinner(false);
      selectedQueue = queueInject.data[0];
    }
    ui.showSpinner(false);
    const tmp = queueInject.data.length - 1;
    const lastKanbanId = queueInject.data[tmp].id;

    gEvents.emit("selectedQueue", { selectedQueue, lastKanbanId });
    return queueInject;
  } else {
    ui.showSpinner(false);
    ui.showNotification(queueInject.error, "danger", 3000);
  }
}

const authBox = {
  title(text, session, nth) {
    const nthSelect = nth != null ? `[data-auth-nth="${nth}"]` : ``;
    const container = $(
      `.auth-confirm[data-auth-session="${session}"]${nthSelect}`
    );

    //change text based on auth name
    container.siblings(".auth-confirm-title").html(text);
  },

  text(text, session, nth) {
    const nthSelect = nth ? `[data-auth-nth="${nth}"]` : ``;
    const container = $(
      `.auth-confirm[data-auth-session="${session}"]${nthSelect}`
    );

    //change text based on auth name
    container.html(text);
    container.attr("data-auth-name", text);
  },

  box(status, session, nth, name) {
    const nthSelect = nth != null ? `[data-auth-nth="${nth}"]` : ``;
    const nameSelect = name != null ? `[data-auth-name="${name}"]` : ``;
    const model1 = {
      container: $(
        `.auth-confirm.model-1[data-auth-session="${session}"]${nthSelect}${nameSelect}`
      ),
      title: $(
        `.auth-confirm.model-1[data-auth-session="${session}"]${nthSelect}${nameSelect}`
      ).siblings(".auth-confirm-title"),
    };
    const model2 = {
      container: $(
        `.auth-confirm.model-2[data-auth-session="${session}"]${nthSelect}${nameSelect}`
      ),
      title: $(
        `.auth-confirm.model-2[data-auth-session="${session}"]${nthSelect}${nameSelect}`
      ).siblings(".auth-confirm-title"),
    };

    if (status) {
      model1.container.parent().removeClass("bg-light");
      model1.container.parent().addClass("bg-success");
      model1.container.parent().addClass("text-light");
      model1.container.removeClass("text-primary");
      model1.container.addClass("text-light");

      model1.title.removeClass("text-dark");
      model1.title.addClass("text-light");
      model1.title.html("ID SCANNED");

      model2.container.removeClass("bg-secondary");
      model2.container.addClass("bg-success");

      model2.title.removeClass("text-dark");
      model2.title.addClass("text-success");
      model2.title.html("ID SCANNED");
    } else {
      // added into eventlistener in order to keep style until content changed
      const __changeModel1 = () => {
        model1.container.parent().removeClass("bg-success");
        model1.container.parent().removeClass("text-light");
        model1.container.parent().addClass("bg-light");
        model1.container.removeClass("text-light");
        model1.container.addClass("text-primary");

        model1.title.removeClass("text-light");
        model1.title.addClass("text-dark");
        model1.title.html("PLEASE SCAN YOUR ID");
      };

      ui.once("content", function () {
        __changeModel1();
        ui.removeAllListeners("section");
        ui.removeAllListeners("popup");
      });

      ui.once("section", function () {
        __changeModel1();
        ui.removeAllListeners("section");
        ui.removeAllListeners("popup");
      });

      ui.once("popup", function () {
        __changeModel1();
        ui.removeAllListeners("section");
        ui.removeAllListeners("popup");
      });

      model2.container.removeClass("bg-success");
      model2.container.addClass("bg-secondary");

      model2.title.removeClass("text-success");
      model2.title.addClass("text-dark");
      model2.title.html("PLEASE SCAN YOUR ID");
    }
  },
};

/********************** DOM OPERATIONS *************************/
ui.DOMContentLoaded(async function () {
  if (config.machineId == null) {
    const msg = "Machine Id is not configured in config!!!";
    ui.showNotification(msg, "danger", 5000);
    console.error(msg);
    return;
  }

  localStorage.clear(); // clear saved localStorage on reload

  // initialize template
  await ui.init();

  // data handling init
  shift.init();

  if (config.debug) {
    _debugging(RFIDLogin);
  }

  // show main section and content
  ui.showSection("login");

  // wait until login is successful
  for (
    let login = await api.login();
    !login.status;
    login = await api.login()
  ) {
    if (!login.status) {
      ui.showNotification(
        "Failed Connection. Attempting to re-connect in 2s",
        "danger"
      );
    }
  }

  // change machine name into one from backend
  api.getMachineId(config.machineId, function (data) {
    $(".machine-name").html(data.name);
  });

  ui.showNotification("READY", "primary", 500);

  const NGs = await api.NGList();
  const dandoriList = await api.getDandoriLists();
  const responPosition = await api.getEmployeePosition();
  

  let SCWList = null;
  for (
    SCWList = await api.getSCWlists();
    !SCWList.status;
    SCWList = await api.getSCWlists()
  ) {
    if (!SCWList.status) {
      ui.showNotification(
        "Trying get SCW List. Attempting to re-connect in 2s",
        "danger"
      );
    }
    await helper.sleep(2000);
  }

  let scwUtility = null;
  for (
    scwUtility = await api.getUtilityScw();
    !scwUtility.status;
    scwUtility = await api.getUtilityScw()
  ) {
    if (!scwUtility.status) {
      ui.showNotification(
        "Trying get UTILITY SCW List. Attempting to re-connect in 2s",
        "danger"
      );
    }
    await helper.sleep(2000);
  }

  await generateSCWMenu(SCWList.data);

  // trigger event isReady
  ui.documentReady();

  gEvents.emit("dandoriLists", dandoriList);
  gEvents.emit("SCWLists", SCWList.data);
  gEvents.emit("utilitySCW", scwUtility.data);
  localStorage.setItem("scwList", JSON.stringify(SCWList?.data));
  gEvents.emit("NGlists", NGs.data);
  gEvents.emit("employeePosition", responPosition.data);

  setInterval(async () => {
    try {
      const datacycle = await api.getCycleModul(config.machineId);
      const databaterai = await api.getBateraiModul(config.machineId);
      gEvents.emit("datacycle", datacycle);
      gEvents.emit("databaterai", databaterai);
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  }, 1000);
  
  const updateDisplay = (details, summary, summaryPerKanban) => {

    

    $(".shift-qty-per-kanban").html(summary.kanban?.qty);
    $(".shift-pcs-ok").html(summary?.ok);

    $(".shift-pcs-ng").html(summary?.ng);
    $(".shift-pcs-ng-scw").html(shift.production?.summary?.ng || 0);

    
    $(".shift-ct-plan").html((summary.kanban?.ct / 1000).toFixed(1));
    $(".shift-ct-actual").html((summary.ct / 1000).toFixed(1));
    // $(".shift-plan-kanban").html(summary.kanban?.planKanban);
    $(".shift-plan-kanban").html(queueInject?.data[0]?.totalOrder?.planKanban || 0);
    $(".shift-act-kanban").html(summary.kanbanDone);
    $(".shift-sisa-kanban").html(
      (queueInject?.data[0]?.totalOrder?.planKanban || 0) - summary.kanbanDone
    );

    if (summary.ct < summary.kanban?.ct) {
      $(".shift-ct-actual").removeClass("text-danger");
      $(".shift-ct-actual").addClass("text-success");
    } else {
      $(".shift-ct-actual").removeClass("text-success");
      $(".shift-ct-actual").addClass("text-danger");
    }

    $(".shift-kanban-qty-plan").html(details?.plan?.kanban?.target);
    $(".shift-kanban-qty-act").html(summary.kanbanDone);
    $(".shift-kanban-qty-different").html(
      summary.kanbanDone - details?.plan?.kanban?.target
    );
  };

  const btn_ng_production = document.querySelector(".wrapper-btn-ng");
  btn_ng_production.addEventListener("click", (e) => {
    itemCard = e.target;
    if (itemCard.classList.contains("button-action-IRM-NG")) {
      ui.showPopup("ng-list");
    }
  });

  const btn_ng_SCW = document.querySelector(".wrapper-btn-ng-scw");
  btn_ng_SCW.addEventListener("click", (e) => {
    itemCard = e.target;
    if (itemCard.classList.contains("btn-ng-inSCW")) {
      ui.showPopup("ng-list");
    }
  });
  /*** SHIFT CALLBACKS ***/
  shift
    .setCallback("onProximity", (details, summary, summaryPerKanban) => {
      updateDisplay(details, summary, summaryPerKanban);
      shift.synchronize();
    })
    .setCallback("onStart", (details, summary, summaryPerKanban) => {
      updateDisplay(details, summary, summaryPerKanban);
    })
    .setCallback("onInterval", (details, summary, summaryPerKanban) => {
      updateDisplay(details, summary, summaryPerKanban);
    })
    .setCallback(
      "onSynchronize",
      async (details, summary, summaryPerKanban) => {
        if (summary.pcs - summary.ng !== 0) {
          document.querySelector(".wrapper-btn-ng").innerHTML = `
                <button
                class="button-action-IRM-NG">
                    NG
                </button>
            `;

          document.querySelector(".wrapper-btn-ng-scw").innerHTML = `
          <button
          class="btn btn-block btn-primary py-5 flex-fill bd-highlight font-weight-bold production-button ng-menu btn-ng-inSCW"
          data-ng="scw"
          data-display-hold="1"
          style="height: 178px">
          NG <sub>Trial</sub>
          </button>
            `;
        } else {
          document.querySelector(".wrapper-btn-ng").innerHTML = "";
          document.querySelector(".wrapper-btn-ng-scw").innerHTML = "";
        }
        console.log("onSynchronize", new Date());
        updateDisplay(details, summary, summaryPerKanban);

        const bodySend = bodySend_saveLog();

        const save = await api.saveLog(bodySend);
        // production finish
        if (summary.ok >= summary.kanban?.qty * summary.kanban?.planKanban) {
          let allQueue = null;
          for (
            allQueue = await api.SetDoneQueueInject(
              summary.orderId,
              shift.operator.id
            );
            !allQueue.status && allQueue.error != "Data masih kosong!";
            allQueue = await api.SetDoneQueueInject(
              summary.orderId,
              shift.operator.id
            )
          ) {
            if (!allQueue.status) {
              ui.showNotification(
                "Trying Queue Done. Attempting to re-connect in 2s",
                "danger"
              );
            }
            await helper.sleep(2000);
          }
          ui.showNotification("Queue Telah Selesai", "success");

          const statusKanbanDone = allQueue.data
            .map((item) => item.status)
            .lastIndexOf(true);

          statusKanbanDone === 0
            ? renderQueue(allQueue, statusKanbanDone + 3)
            : renderQueue(allQueue, statusKanbanDone + 2 || 3);

          gEvents.emit("queueInject", allQueue);
        }
      }
    );
  /*** DANDORI CALLBACKS ***/
  let startDandoriId = null;
  shift.dandori
    .setCallback("onStart", async (current) => {
      if (config.debug) {
        console.log("onStart", current);
      }
      $(".dandoriTitle").html(current.category.name);
      document.querySelector(".dandori-duration-plan").innerHTML =
        helper.msToHms(current.plan.duration, true);

      const { data, status, error } = await api.dandoriStart(
        current.shift.id,
        current.category.id,
        current.time.start,
        shift.production?.kanban?.part?.id,
        shift.production?.kanban?.queueId
      );
      if (status) {
        timer.use("dandori").start();
        dandori.insertId(data?.insertId);
        await dandoriAuth();
      } else {
        ui.showNotification(error, "danger", 5000);
        const prevSection = localStorage.getItem("previous-section");
        ui.showSection(prevSection);
      }
    })
    .setCallback("onFinish", async (current) => {
      if (config.debug) {
        console.log("onFinish", current);
      }
      ui.showSpinner();
      const { data, status, error } = await api.dandoriFinish(
        dandori.insertIdBack,
        current.time.finish
      );
      if (status) {
        // console.log("finsih dandori");
      } else {
        ui.showSpinner(false);
        ui.showNotification(error, "danger", 5000);
      }
      ui.showSpinner(false);
    });
  // Timers Initialization
  timer
    .register("production-time")
    .setCallback("onUpdate", function (current, cummulative) {
      //~ console.log(shift.production, timer.use("production-time").value());
      $("#production-time").html(helper.msToHms(cummulative, true));
    });

  timer
    .register("production")
    .setCallback("onUpdate", function (current, cummulative) {
      shift.setDuration(cummulative);
      $(".shift-time-running").html(helper.msToHms(cummulative, true));
    });

  timer
    .register("downtime")
    .setCallback("onUpdate", function (current, cummulative) {
      $(".shift-time-downtime").html(helper.msToHms(cummulative, true));
    })
    .setCallback("onPause", function (current, cummulative) {
      shift.synchronize();
    })
    .setCallback("onStop", function (current, cummulative) {
      shift.synchronize();
    });

  timer
    .register("downtimeA")
    .setCallback("onUpdate", function (current, cummulative) {})
    .setCallback("onPause", function (current, cummulative) {
      shift.synchronize();
    })
    .setCallback("onStop", function (current, cummulative) {
      shift.synchronize();
    });

  timer
    .register("shift-break")
    .setCallback("onStart", function (current, cummulative) {
      document.querySelector(".text-timer-break-irm").innerHTML =
        helper.msToHms(shift.breaks.totalDuration(), true);
    })
    .setCallback("onPause", function (current, cummulative) {
      if (timer.use("downtime").status()) {
        timer.use("downtime").pause();
      }

      shift.synchronize();
    })
    .setCallback("onUpdate", function (current, cummulative) {
      $(".shift-break-duration-actual").html(helper.msToHms(current, true));

      const container = $(".shift-break-duration-actual");
      const plan = shift.breaks.totalDuration();

      container.html(helper.msToHms(cummulative, true));

      if (cummulative > plan) {
        // start downtime if break duration is more than planned duration
        if (!timer.use("downtime").status()) {
          timer.use("downtime").start();
        }

        // resume production timer if break duration is more than planned duration
        if (!timer.use("production").status()) {
          timer.use("production").start();
        }

        container.removeClass("text-success");
        container.addClass("text-danger");
      } else {
        container.removeClass("text-danger");
        container.addClass("text-success");
      }
    });

  timer
    .register("scw")
    .setCallback("onUpdate", function (current, cummulative) {
      $(".scw-duration-actual").html(helper.msToHms(current, true));
    });

  timer
    .register("dandori-scw")
    .setCallback("onUpdate", function (current, cummulative) {
      $(".dandori-scw-timer").html(helper.msToHms(current, true));
    })
    .setCallback("onStop", function (current, cummulative) {
      $(".dandori-scw-timer").html(helper.msToHms(current, true));
    });

  timer
    .register("dandori")
    .setCallback("onStop", function (current, cummulative) {
      shift.synchronize();
    })
    .setCallback("onPause", function (current, cummulative) {
      shift.synchronize();
    })
    .setCallback("onUpdate", function (current, cummulative) {
      const container = $(".dandori-duration-actual");
      const { plan } = shift.dandori.current;
      container.html(helper.msToHms(cummulative, true));

      if (cummulative > plan.duration) {
        if (!timer.use("downtime").status()) {
          timer.use("downtime").start();
        }

        container.removeClass("text-success");
        container.addClass("text-danger");
      } else {
        container.removeClass("text-danger");
        container.addClass("text-success");
      }
    });

  // shift authorization settings
  shiftAuth.init(staticData.positions.data);

  shiftAuth.setCallback("onVerified", function (pos, session) {
    authBox.box(true, session, null, pos.alias ?? pos.name);
    const msg = `Verification Success "<b>${pos.alias ?? pos.name}</b>"`;
    ui.showNotification(msg, "success");

    $(`[data-auth-name="${pos.alias ?? pos.name}"]`).removeAttr(
      "data-auth-name"
    );
  });

  shiftAuth.setCallback("onFailed", function (pos, session) {
    const msg = `Verification Failed : Scanned RFID is "<b>${pos.name}</b>"`;
    ui.showNotification(msg, "warning");
  });

  shiftAuth.setCallback("onAdded", function (list, session) {
    const len = list.length;
    for (let idx = 0; idx < len; ++idx) {
      authBox.text(list[idx].alias ?? list[idx].name, session, idx);
    }
  });

  shiftAuth.setCallback("onReset", function (list, session) {
    authBox.box(false, session);
    for (const pos of list) {
      $(`[data-auth-name="${pos.name}"]`).removeAttr("data-auth-name");
    }
  });

  // LOGIN RFID on home page
  shiftAuth
    .use("login")
    .addRequiredByName(
      { name: ["operator", "leader"], group: 1, alias: "OPERATOR" },
      true
    );

  await shiftAuth.use("login").waitForAuth(async function () {
    shiftAuth.resetRequired();
    const isError = await listQueue();
    ui.showSpinner();
    if (isError?.status != undefined || isError?.status != false) {
      display.release();
      ui.showSection("part-info");
      ui.showSpinner(false);
    } else {
      const tmp =
        isError.error === undefined
          ? "Data Hari Ini Masih Kosong"
          : isError.error;
      document.querySelector("#reason-error-queue").innerHTML = tmp;
      ui.showSpinner(false);
      ui.showPopup("error-queue-pop");
    }
  });

  /* ----- End of Section and content initialization ----- */
});

ui.ready(async function () {
  if (!config.showCursor) {
    $("body").css("cursor", "none");
  } else {
    $("body").css("cursor", config.showCursor);
  }
});

/***************** NG ************************/
ui.ready(function () {
  $(".ng-menu").on("click", async function () {
    const typeNG = $(this).data("ng");

    $(".ng-cat-" + typeNG)
      .siblings()
      .removeClass("active");
    $(".ng-cat-" + typeNG).addClass("active");

    display.release();
  });
});

ui.ready(function () {
  const ngCategoryButton = document.querySelectorAll(".ng-category-button");
  for (const button of ngCategoryButton) {
    $(button).on("click", async function () {
      const id = +$(this).data("ng-category");
      const selector = document.querySelector(".ng-category-" + id);
      const container = $(selector);

      container.siblings().hide("");
      container.show("");
    });
  }
});
/***************** SHIFT PRODUCTION ************************/
ui.ready(function () {
  document
    .querySelector(".btn-action-error-queue")
    .addEventListener("click", () => {
      ipcRenderer.send("app-reload");
    });
});

ui.ready(function () {
  $(".stop-shift").on("click", async function () {
    const { summary } = shift.production;

    if (
      summary.ok < summary.kanban.qty * summary.kanban.planKanban ||
      (summary.ok >= summary.kanban.qty * summary.kanban.planKanban &&
        resultProductRemaining.length > 1)
    ) {
      ui.showPopup("scan-pengawas-pop");
      shiftAuth
        .clearWaitForAuth()
        .use("list-order-finish")
        .addRequiredByName(
          { name: ["leader"], group: 2, alias: "LEADER" },
          true
        );

      const wait = await shiftAuth.use("list-order-finish").waitForAuth();
      if (!wait) {
        ui.showPopup(false);
        return;
      }
      ui.showSpinner();
      ui.showPopup(false);
      // stop shift and send last log to serve
      // api.saveLog(bodySend_saveLog());
      // shift.stop();
      // reload list queue
      await listQueue();
    } else if (resultProductRemaining.length <= 1) {
      ui.showSpinner();
      // reload list queue
      await listQueue();
    }

    const { status, error } = await api.finishShift(shift.details.id);
    ui.showSpinner();
    if (status) {
      timer.use("production").stop();
      timer.use("production-time").stop();
      shift.synchronize();
      // stop shift and send last log to server
      // api.saveLog(bodySend_saveLog());
      shift.stop();
      ipcRenderer.send("app-reload");
      display.release();
    } else {
      ui.showSpinner(false);
      ui.showNotification(error, "danger", 2000);
    }
  });
});
/***************** SCW ***********************/
// let insertId = 0;

ui.ready(async function () {
  global.wrapperutilityScw = document.querySelector(
    ".wrapper-content-utilityScw"
  );
  const utilityBtn = document.querySelectorAll(".box-utilityScw");
  const btnConfirm = document.querySelector("#btn-confirm-utilityScw");

  const renderUtilityScw = (selector, items) => {
    if (items) {
      try {
        selector.innerHTML = "";
        items.map((item) => {
          selector.innerHTML += `<button class="box-utilityScw selectable" id="${
            item.id
          }">
              ${item.name.toUpperCase()}
        </button>`;
        });
      } catch (error) {
        console.error(error);
      }
    } else {
      selector.innerHTML = `<h3 class="empty-utilityScw">Utility Empty</h3>`;
    }
  };

  global.allUtilityscw;
  global.selectedUtilityScw = "";
  const utilityScw = () => {
    gEvents.on("utilitySCW", (data) => {
      allUtilityscw = data;
      renderUtilityScw(wrapperutilityScw, allUtilityscw);
    });
  };

  await utilityScw();

  const delClassActive = () => {
    [...utilityBtn].map((element) => {
      element.classList.remove("active");
    });
  };

  wrapperutilityScw.addEventListener("click", (e) => {
    const item = e.target;
    if (item.classList.contains("box-utilityScw")) {
      if (!item.classList.contains("active")) {
        const children = [...item.parentElement.children];
        children.map((element) => element.classList.remove("active"));
        item.classList.add("active");
        selectedUtilityScw = allUtilityscw.filter((utilityscw) => {
          return utilityscw.id === Number(item.id);
        })[0];
      } else if (item.classList.contains("active")) {
        const children = [...item.parentElement.children];
        children.map((element) => element.classList.remove("active"));
        item.classList.remove("active");
        selectedUtilityScw = "";
      }
    }
  });
  //   end add event click when click dandori menu
});

async function scwNextStep(id = null, triggeredByWS = false) {
  let wait;
  if (!triggeredByWS) {
    wait = await shiftAuth.use("scw").waitForAuth();
  }
  // stop execution if waitForAuth is cleared forcefully
  if (!triggeredByWS) {
    if (!wait) {
      return;
    }
  }

  const lastStepDuration = timer.use("scw").getTotal() - scw.totalDuration;
  console.log(lastStepDuration);
  const next = id
    ? scw.start(scw.currentId, lastStepDuration)
    : scw.nextStep(lastStepDuration);

  if (scw.problem && scw.problem.onLastStep) {
    $('.auth-confirm.model-1[data-auth-session="scw"]').parent().hide();
  }

  shiftAuth.use("scw").addRequiredByName(scw.authorization, true);
  if (next) {
    timer.use("scw").reset();
    shift.synchronize();
    $(".scw-problem-category").html(scw.problem.category.name);
    $(".scw-problem-name").html("Problem : " + scw.problem.name);
    $(".scw-problem-utilityscw").html(
      "Utility Abnormality : " + selectedUtilityScw.name
    );
    ui.showContent("scw-step-" + scw.problem.step);
    if (scw.problem.step === 1) {
      ui.showPopup(false);
      if (!triggeredByWS) {
        const bodySendConfirmation = {
          partId: shift.production?.kanban?.part?.id,
          queueId: shift.production?.kanban?.queueId,
          shiftId: shift.details?.id,
          operatorId: shift.production?.operator?.id,
          reasonId: scw.problem?.id,
          start: scw.startTime,
        };
        await api.setConfirmationAbnormality(
          startScw.data.insertId,
          bodySendConfirmation
        );
        console.log("confirmSet");
      }
      ui.showSpinner(false);
    }

    if ("scw-step-1") {
      if (!startShift.data.abnormality) {
        if (selectedUtilityScw.id !== undefined) {
          const bodySendUtilitySCW = {
            abnormalityUtilityId: selectedUtilityScw.id,
          };

          await api.addAbnormalityUtility(
            startScw.data.insertId,
            bodySendUtilitySCW
          );
        }
      } else {
        const bodySendUtilitySCW = {
          abnormalityUtilityId: selectedUtilityScw.id,
        };
        await api.addAbnormalityUtility(
          startShift.data.abnormality.id,
          bodySendUtilitySCW
        );
      }
      ui.showPopup(false);
    }
    scwNextStep();
  } else {
    const timestamp = date.format(new Date(), "YYYY-MM-DD HH:mm:ss");
    ui.showSpinner();
    let finish = null;
    for (
      finish = await api.scwFinish(scw.insertIdBack, timestamp);
      !finish.status;
      finish = await api.scwFinish(scw.insertIdBack, timestamp)
    ) {
      if (!finish.status) {
        ui.showNotification(
          "Failed Connection. Attempting to re-connect in 2s",
          "danger"
        );
      }

      await helper.sleep(2000);
    }
    timer.use("scw").stop(true);
    if (scw.problem?.category?.type === "B") {
      timer.use("downtime").add(scw.totalDuration);
    } else {
      timer.use("downtimeA").add(scw.totalDuration);
    }
    shiftAuth.resetRequired();
    await scw.finish();
    if (startShift.data.abnormality) {
      startShift.data.abnormality = null;
    }
    shift.synchronize();
    selectedUtilityScw = "";
    idReason = "";
    ui.showSpinner(false);
    const prevSection = localStorage.getItem("previous-section");
    $(".scw-problem-category").html("");
    $(".scw-problem-name").html("");
    ui.resetContent(".scw-contents");
    ui.showSection("injection-resin-menu");
  }
}

ui.ready(function () {
  $(".scw-cancel").on("click", function () {
    timer.use("scw").stop(true);

    scw.reset();

    shiftAuth.clearWaitForAuth();
    ui.showSection("injection-resin-menu");
    idReason = "";
  });
});

ui.ready(function () {
  $(".scw-next-step").on("click", function () {
    //~ scwNextStep();
  });
});

ui.ready(function () {
  $(".scw-item-button").on("click", function () {
    global.idReason = $(this).data("scw-id");
  });
});

ui.ready(function () {
  $(".scw-confirm-reason").on("click", async function () {
    ui.showSpinner();
    await helper.sleep(1000);
    ui.showPopup("scw-confirm-pop");
    document.querySelector(".wrapper-utility-pop").innerHTML = `
    <button class="btn-act-scw-utility-pop accept btn-accept-reasonscw">Ya</button>
    <button class="btn-act-scw-utility-pop not close-popup-scw">Tidak</button>`;
    ui.showSpinner(false);
  });
});

ui.ready(function () {
  const box_btn_utility = document.querySelector(".wrapper-utility-pop");
  box_btn_utility.addEventListener("click", async (e) => {
    itemCard = e.target;
    if (itemCard.classList.contains("btn-accept-reasonscw")) {
      if (idReason) {
        if (scw.currentId == undefined) {
          ui.showSpinner();
          document.querySelector(".wrapper-utility-pop").innerHTML = `
          <button class="btn-act-scw-utility-pop disabled" disabled>Ya</button>
          <button class="btn-act-scw-utility-pop disabled" disabled>Tidak</button>`;

          const bodySend = {
            partId: shift.production?.kanban?.part?.id,
            queueId: shift.production?.kanban?.queueId,
            shiftId: shift.details?.id,
            operatorId: shift.production?.operator?.id,
            reasonId: idReason,
            start: scw.startTime,
          };
          global.startScw = null;
          for (
            startScw = await api.scwStart(bodySend);
            !startScw.status;
            startScw = await api.scwStart(bodySend)
          ) {
            if (!startScw.status) {
              ui.showNotification(
                "Failed Connection. Attempting to re-connect in 2s",
                "danger"
              );
            }
            await helper.sleep(2000);
          }

          ui.showSpinner(false);
          scw.insertId(startScw.data?.insertId);

          scw.setCurrentId(idReason);
          // console.log("scw-start", startScw);
          ui.showPopup("confirm-waiting-scan-scw-pop");
          scwNextStep(true);
          ui.showSpinner();
        }
      } else if (!idReason) {
        ui.showNotification(
          "Silahkan Pilih Abnormality Reason Dahulu",
          "danger",
          3000
        );
        ui.showPopup(false);
      }
    }

    if (itemCard.classList.contains("close-popup-scw")) {
      idReason = "";
      ui.showPopup(false);
    }
  });

  api.websocket.on("ws-valid", async (data) => {
    console.log("ws-valid", data);
    api.websocket.send({
      module: "abnormality",
      action: "list-abnormality",
      body: {
        id: startScw.data.insertId,
      },
      expectReturn: true,
    });
  });

  api.websocket.on("ws-message", async (data) => {
    const { target } = data;

    if (target == null || target === config.machineId) {
      if (data.module === "abnormality" && data.action === "list-abnormality") {
        if (data.status) {
          if (data.data.id === startScw.data.insertId) {
            ui.showSpinner(false);
            ui.showPopup(false);
            scwNextStep(true, true);
            shiftAuth
              .clearWaitForAuth()
              .use("scw")
              .addRequiredByName(
                {
                  name: ["maintenance"],
                  group: 0,
                  alias: undefined,
                },
                true
              );
          }
        }
      }
    }
  });
});

ui.ready(function () {
  $(".scw-reason-confrim").on("click", function () {
    if (selectedUtilityScw.length === 0) {
      ui.showPopup("scw-utility-pop");
    } else {
      ui.showPopup("utilityAbnormality-confirm-pop");
      const selectedUtilityName = document.querySelector(".selected-utility");
      selectedUtilityName.innerText = selectedUtilityScw.name;
    }
  });
});

ui.ready(function () {
  $("#btn-accept-abnormalityUtility").on("click", function () {
    ui.showPopup("scw-menu-pop");
  });
});

ui.ready(function () {
  $("#btn-not-accept-abnormalityUtility").on("click", function () {
    selectedUtilityScw = "";
  });
});

ui.ready(function () {
  $(".close-confrim-scw").on("click", function () {
    ui.showPopup(false);
  });
});

ui.ready(async function () {
  let scwLists;
  const getScwLists = () => {
    gEvents.on("SCWLists", (data) => {
      scwLists = data;
    });
  };
  await getScwLists();
  $(".scw").on("click", async function () {
    ui.showContent("scw-menu-run");

    $('.auth-confirm.model-1[data-auth-session="scw"]').parent().show();

    // console.log("scw.problem", scw.problem);

    shiftAuth
      .clearWaitForAuth()
      .use("scw")
      .addRequiredByName({ name: ["leader"], group: 2, alias: "LEADER" }, true);
    console.log("shiftAuth.listRequired()", shiftAuth.listRequired());
    const timestamp = date.format(new Date(), "YYYY-MM-DD HH:mm:ss");
    scw.init(scwLists, timestamp);
    timer.use("scw").start(true);

    display.release();
    ui.showPopup(false);
  });
});

ui.ready(function () {
  /******************** Dandori SCW Popup *****************************/
  const btnSCWDandori = document.querySelector("#btn-scw-dandori");

  btnSCWDandori.addEventListener("click", async () => {
    timer.use("dandori-scw").start();
    const bodySend = {
      queueId: shift.production?.kanban?.queueId,
      partId: shift.production?.kanban?.part.id,
      shiftId: shift.details?.id,
      operatorId: shift.production?.operator?.id,
      start: date.format(new Date(), "YYYY-MM-DD HH:mm:ss"),
    };
    const dandoriSCW = await api.dandoriSCWStart(bodySend);
    if (dandoriSCW.status) {
      dandori.insertIdDandoriSCW(dandoriSCW.data.insertId);
      ui.showPopup("dandori-scw");

      // console.log("dandori-scw START", Date.now());

      shiftAuth
        .clearWaitForAuth()
        .use("dandori-scw")
        .addRequiredByName(
          [
            {
              name: ["maintenance"],
              group: 0,
              alias: undefined,
            },
            {
              name: [["leader", "operator"]],
              group: 1,
              alias: "OPERATOR",
            },
          ],
          true
        );

      display.release();

      await shiftAuth.use("dandori-scw").waitForAuth(async function () {
        // console.log("dandori-scw FINISH");
        ui.showSpinner();
        let dandoriSCWFin = null;
        for (
          dandoriSCWFin = await api.dandoriSCWFinish(
            dandori.insertIdBackDandoriSCW
          );
          !dandoriSCWFin.status;
          dandoriSCWFin = await api.dandoriSCWFinish(
            dandori.insertIdBackDandoriSCW
          )
        ) {
          if (!dandoriSCWFin.status) {
            ui.showNotification(
              "Failed Connection. Attempting to re-connect in 2s",
              "danger"
            );
          }

          await helper.sleep(2000);
        }
        timer.use("dandori-scw").pause();
        ui.showPopup(false);
        ui.showSpinner(false);
        ui.showSection("dandori-details-sec");
      });

      await dandoriAuth();
    } else {
      ui.showSpinner(false);
      ui.showNotification(dandoriSCW.error, "danger");
    }
  });
});

ui.ready(function () {
  $(".btn-action-scan-pengawas.close-popup").click(function () {
    shiftAuth.clearWaitForAuth();
  });
});

ui.ready(function () {
  $("#btn-choose-kanban").on("click", async function () {
    const { summary } = shift.production;
    if (
      summary.ok < summary.kanban.qty * summary.kanban.planKanban ||
      (summary.ok >= summary.kanban.qty * summary.kanban.planKanban &&
        resultProductRemaining.length > 1)
    ) {
      ui.showPopup("scan-pengawas-pop");
      shiftAuth
        .clearWaitForAuth()
        .use("list-order-kanban")
        .addRequiredByName(
          { name: ["leader"], group: 2, alias: "LEADER" },
          true
        );

      const wait = await shiftAuth.use("list-order-kanban").waitForAuth();
      if (!wait) {
        ui.showPopup(false);
        return;
      }
      ui.showSpinner();

      ui.showPopup(false);
      // stop shift and send last log to server
      api.saveLog(bodySend_saveLog());
      shift.stop();
      // reload list queue
      const queue = await listQueue();
      const tmp = queue.data.map((item) => item.status).lastIndexOf(false);
      if (tmp < 0) {
        ui.showSpinner(false);
        ui.showNotification("Queue Hari Ini Sudah Selesai", "danger", 5000);
      } else {
        ui.showSection("kanban-menu");
        ui.showSpinner(false);
      }
    } else if (
      summary.ok >= summary.kanban.qty * summary.kanban.planKanban &&
      resultProductRemaining.length <= 1
    ) {
      // stop shift and send last log to server
      api.saveLog(bodySend_saveLog());
      // shift.stop();
      // reload list queue
      const queue = await listQueue();
      const tmp = queue.data.map((item) => item.status).lastIndexOf(false);
      if (tmp <= 0) {
        ui.showSpinner(false);
        ui.showNotification("Queue Hari Ini Sudah Selesai", "danger", 5000);
      }
    }
  });

  document.querySelector("#btn-finsih-shift").addEventListener("click", () => {
    ui.showPopup("finish-pop");
  });
});

/***************** WRITE RFID EMPLOYEE SCAN PENGAWAS************************/
ui.ready(function () {
  const writeAuthRfid = document.querySelector("#rfid-write-auth");
  writeAuthRfid.addEventListener("click", async () => {
    ui.showPopup("rfid-write-click-pop");

    shiftAuth.clearWaitForAuth();
    await helper.sleep(100);

    shiftAuth
      .resetRequired()
      .use("accept-verification")
      .addRequiredByName({ name: ["leader"], group: 2, alias: "LEADER" }, true);

    await shiftAuth.use("accept-verification").waitForAuth(function () {
      ui.showSpinner();
      ui.showSection("rfid-employee-write");
    });
    ui.showPopup(false);
    ui.showSpinner(false);
  });
});

// cancel scan rfid employee
ui.ready(function () {
  $(".cancel-verification-rfid").click(async function () {
    // CLEAR EVERY waitForAuth Instance
    shiftAuth.clearWaitForAuth();
    // add delay, avoiding race condition
    await helper.sleep(100);

    ui.showPopup(false);
    ui.showSpinner(false);

    await mainAuth();
  });
});

/***************** Part-Info ************************/
ui.ready(async function () {
  let dataSlides = [];
  const getSlides = () => {
    gEvents.on("queueInject", (data) => {
      dataSlides = data.data;
    });
  };
  await getSlides();
  // Selector
  const partName = document.querySelector("#part-name-part-info");
  const partNo = document.querySelector("#part-no-part-info");
  const partqtyKanban = document.querySelector("#part-qty-info");
  const partCT = document.querySelector("#part-ct-info");
  const partCustomer = document.querySelector("#part-customer-info");
  const partMaterial = document.querySelector("#part-material-info");
  const partCavity = document.querySelector("#part-cavity-info");
  const partImage = document.querySelector("#part-image");
  const partDetailKanban = document.querySelector("#part-detail-kanban");
  // end Selector
  /**
   * Render slide from data API, data API from index.js
   * */
  let _currentPart = {};
  const getSelectedQueue = () => {
    gEvents.on("selectedQueue", (data) => {
      const { selectedQueue, lastKanbanId } = data;

      _currentPart = {
        idQueue: selectedQueue.id,
        part: selectedQueue.part,
        summary: selectedQueue.summary,
        total: selectedQueue.total,
        duration: selectedQueue.duration,
        lastKanbanId,
      };

      // console.log("_currentPart", _currentPart);

      // selectedPart = await api.getPartDetails(data);
      partName.innerText = selectedQueue?.part?.name;
      partNo.innerText = selectedQueue?.part?.number;
      partqtyKanban.innerText = selectedQueue?.part?.qty_per_kbn;
      partCT.innerText = selectedQueue?.part?.ct;
      partCustomer.innerText = selectedQueue?.customer;
      partMaterial.innerText = selectedQueue?.material?.name;
      partCavity.innerText = selectedQueue?.part?.cavity;
      partImage.innerHTML = `<img
                  class="content-image-part-info-injection-resin"
                  src="${selectedQueue?.part?.image}"
                  alt="${selectedQueue?.part?.name}"
                />`;
      if (selectedQueue?.part?.number === null) {
        partNo.innerText = `-`;
        partDetailKanban.innerHTML = `${selectedQueue?.part?.name}`;
      } else {
        partDetailKanban.innerHTML = `${selectedQueue?.part?.number}<br/>${selectedQueue?.part?.name}`;
      }
    });
  };

  getSelectedQueue();

  const btnConfirm = document.querySelector("#confirm-kanban");
  btnConfirm.addEventListener("click", async () => {
    ui.showSpinner();
    const statusKanban = dataSlides
      .map((item) => item.status)
      .lastIndexOf(false);

    if (statusKanban < 0) {
      ui.showSpinner(false);
      ui.showNotification("Queue Hari Ini Sudah Selesai", "danger", 5000);
      setTimeout(() => {
        ipcRenderer.send("app-reload");
      }, 1000);
    } else {
      global.startShift = await api.startShift(
        config.machineId,
        shift.operator.id
      );
      ///
      if (startShift.status) {
        if (startShift.data.abnormality) {
          if (startShift.data.abnormality) {
            let scwLists = JSON.parse(localStorage.getItem("scwList"));

            const { data } = startShift;
            const { duration } = _currentPart;

            await api.currentQueueSession(
              {
                queueId: _currentPart.idQueue,
                shiftId: data.id,
              },
              function (val) {
                localStorage.setItem("queueSession", val.queueSession);
              }
            );
            shift.start(Date.now());
            shift.production.updateKanban(_currentPart);
            $(".operator-name").html(data.operator.name);
            $(".shift-number").html(data.number);
            shift.updateShift(data);

            timer.use("production").start();
            const startTime = helper.hmsToMs(data.start.split(" ")[1]);
            const timeNow = helper.hmsToMs(date.format(new Date(), "HH:mm:ss"));
            const lastSCWTimesstamp = data.abnormality.start;
            const durationLastSCW = helper.hmsToMs(
              data.abnormality.start.split(" ")[1]
            );

            timer.use("production-time").start();
            timer.use("production-time").reset(true);
            timer.use("production-time").add(timeNow - startTime, "total");

            // reset timer first...
            timer.use("production").reset(true);
            timer.use("downtime").reset(true);
            timer.use("downtimeA").reset(true);
            timer.use("scw").reset(true);

            // ...then add each timer with value sent from server
            timer.use("production").add(duration.production * 1000, "total");

            timer.use("downtime").add(duration.downtime * 1000, "total");

            timer.use("downtimeA").add(duration.downtimeA * 1000, "total");

            timer.use("scw").add(timeNow - durationLastSCW, "total");
            // also add offset start time to calculate CT
            shift.production.offsetStart(duration.production * 1000);
            shift.synchronize();
            scw.init(scwLists, lastSCWTimesstamp);
            timer.use("scw").start();
            ui.showSpinner(false);
            scw.setCurrentId(data.abnormality.reason.id);
            scw.insertId(data.abnormality.id);
            shiftAuth
              .clearWaitForAuth()
              .use("scw")
              .addRequiredByName(
                { name: ["leader"], group: 2, alias: "LEADER" },
                true
              );
            scw.start(scw.currentId, durationLastSCW);
            ui.showPopup(false);
            // scw.nextStep();
            $(".scw-problem-category").html(scw.problem.category.name);
            $(".scw-problem-name").html("Problem : " + scw.problem.name);
            ui.showSection("scw-menu-run");
            ui.showContent("scw-step-1");
            scwNextStep();
          } else {
            ui.showSpinner(false);
            ui.showNotification(startShift.error, "danger");
          }
        } else if (startShift.data.dandori) {
          if (startShift.data.dandori) {
            const { data } = startShift;
            const { duration } = _currentPart;

            await api.currentQueueSession(
              {
                queueId: _currentPart.idQueue,
                shiftId: data.id,
              },
              function (val) {
                localStorage.setItem("queueSession", val.queueSession);
              }
            );

            shift.start(Date.now());
            shift.production.updateKanban(_currentPart);
            $(".operator-name").html(data.operator.name);
            $(".shift-number").html(data.number);
            shift.updateShift(data);

            timer.use("production").start();
            const startTime = helper.hmsToMs(data.start.split(" ")[1]);
            const timeNow = helper.hmsToMs(date.format(new Date(), "HH:mm:ss"));
            const _currentDandori = {
              id: startShift.data.dandori.id,
              name: startShift.data.dandori.reason.name,
              parent: null,
              type: startShift.data.dandori.reason.type || "B",
              plan: {
                duration: helper.hmsToMs(startShift.data.dandori.plan.duration),
              },
            };
            // console.log("_currentDandori", _currentDandori);
            shift.dandori.init(_currentDandori);
            const durationLastDandori = helper.hmsToMs(
              data.dandori.start.split(" ")[1]
            );

            timer.use("production-time").start();
            timer.use("production-time").reset(true);
            timer.use("production-time").add(timeNow - startTime, "total");

            // reset timer first...
            timer.use("production").reset(true);
            timer.use("downtime").reset(true);
            timer.use("downtimeA").reset(true);
            timer.use("dandori").reset(true);

            // ...then add each timer with value sent from server
            timer.use("production").add(duration.production * 1000, "total");

            timer.use("downtime").add(duration.downtime * 1000, "total");

            timer.use("downtimeA").add(duration.downtimeA * 1000, "total");
            timer.use("dandori").add(timeNow - durationLastDandori, "total");

            // also add offset start time to calculate CT
            shift.production.offsetStart(duration.production * 1000);
            shift.synchronize();

            // ui.showSection("dandori-details-sec");

            document.querySelector(".dandori-duration-plan").innerHTML =
              helper.msToHms(_currentDandori.plan.duration, true);

            // $(".dandori-scw-timer").html("00:00:00.0");
            // shift.dandori.start();
            ui.showSpinner(false);
            ui.showSection("dandori-details-sec");

            timer.use("dandori").start();

            shiftAuth
              .clearWaitForAuth()
              .use("dandori")
              .addRequiredByName(
                {
                  name: ["leader"],
                  group: 2,
                },
                true
              );

            const wait = await shiftAuth.use("dandori").waitForAuth();
            ui.showSpinner();
            if (wait) {
              timer.use("downtime").pause();
              timer.use("dandori").stop(true);
              const dandoriSCW = timer.use("dandori-scw").getTotal();
              timer.use("dandori-scw").stop(true);
              timer.use("downtime").add(dandoriSCW);
            }

            let finishDandori = null;
            finishDandori = await api.dandoriFinish(
              _currentDandori.id,
              helper.formatDate(new Date(), "YYYY-MM-DD HH:mm:ss")
            );
            ui.showSpinner(false);
            ui.showSection("injection-resin-menu");
          } else {
            ui.showSpinner(false);
            ui.showNotification(startShift.error, "danger");
          }
        } else if (startShift.data.productionBreak) {
          if (startShift.data.productionBreak) {
            const { data } = startShift;
            const { duration } = _currentPart;

            await api.currentQueueSession(
              {
                queueId: _currentPart.idQueue,
                shiftId: data.id,
              },
              function (val) {
                localStorage.setItem("queueSession", val.queueSession);
              }
            );

            const durationLastBreak = helper.hmsToMs(
              data.productionBreak.start.split(" ")[1]
            );

            shift.start(Date.now());
            shift.production.updateKanban(_currentPart);
            $(".operator-name").html(data.operator.name);
            $(".shift-number").html(data.number);
            shift.updateShift(data);

            timer.use("production").start();
            const startTime = helper.hmsToMs(data.start.split(" ")[1]);
            const timeNow = helper.hmsToMs(date.format(new Date(), "HH:mm:ss"));

            timer.use("production-time").start();
            timer.use("production-time").reset(true);
            timer.use("production-time").add(timeNow - startTime, "total");

            // reset timer first...
            timer.use("production").reset(true);
            timer.use("downtime").reset(true);
            timer.use("downtimeA").reset(true);
            timer.use("shift-break").reset(true);

            // ...then add each timer with value sent from server
            timer.use("production").add(duration.production * 1000, "total");

            timer.use("downtime").add(duration.downtime * 1000, "total");

            timer.use("downtimeA").add(duration.downtimeA * 1000, "total");

            timer.use("shift-break").add(timeNow - durationLastBreak, "total");

            // also add offset start time to calculate CT
            shift.production.offsetStart(duration.production * 1000);
            shift.synchronize();
            ui.showSpinner(false);
            ui.showSection("break");

            timer.use("shift-break").start();
            insertId = startShift.data.productionBreak.id;
            shiftAuth
              .resetRequired()
              .use("shift-break")
              .addRequiredByName(shift.breaks.auth, true);
            await shiftAuth.use("shift-break").waitForAuth(async function () {
              ui.showSpinner();
              let finish = null;
              for (
                finish = await api.finishBreak(
                  insertId,
                  helper.formatDate(new Date())
                );
                !finish.status;
                finish = await api.finishBreak(
                  insertId,
                  helper.formatDate(new Date())
                )
              ) {
                if (!finish.status) {
                  ui.showNotification(
                    "Failed Connection. Attempting to re-connect in 2s",
                    "danger"
                  );
                }

                await helper.sleep(2000);
              }
              // timer.use("shift-break").pause();
              // resume production timer if it's paused
              if (!timer.use("production").status()) {
                timer.use("production").start();
              }
              ui.showSpinner(false);
              ui.showSection("injection-resin-menu");
            });
          } else {
            ui.showSpinner(false);
            ui.showNotification(startShift.error, "danger");
          }
          ///
        } else {
          const { data } = startShift;
          const { duration } = _currentPart;

          await api.currentQueueSession(
            {
              queueId: _currentPart.idQueue,
              shiftId: data.id,
            },
            function (val) {
              localStorage.setItem("queueSession", val.queueSession);
            }
          );

          shift.start(Date.now());
          shift.production.updateKanban(_currentPart);
          $(".operator-name").html(data.operator.name);
          $(".shift-number").html(data.number);
          shift.updateShift(data);

          timer.use("production").start();
          const startTime = helper.hmsToMs(data.start.split(" ")[1]);
          const timeNow = helper.hmsToMs(date.format(new Date(), "HH:mm:ss"));

          timer.use("production-time").start();
          timer.use("production-time").reset(true);
          timer.use("production-time").add(timeNow - startTime, "total");

          // reset timer first...
          timer.use("production").reset(true);
          timer.use("downtime").reset(true);
          timer.use("downtimeA").reset(true);

          // ...then add each timer with value sent from server
          timer.use("production").add(duration.production * 1000, "total");

          timer.use("downtime").add(duration.downtime * 1000, "total");

          timer.use("downtimeA").add(duration.downtimeA * 1000, "total");

          // also add offset start time to calculate CT
          shift.production.offsetStart(duration.production * 1000);
          shift.synchronize();

          ui.showSpinner(false);
          ui.showSection("injection-resin-menu");
        }
      } else {
        ui.showSpinner(false);
        ui.showNotification(startShift.error, "danger");
      }
    }
  });

  // end passing data

  /***************** Pop-up Scan Pengawas ************************/
  const btnListOrder = document.querySelector("#btn-list-order");
  btnListOrder.addEventListener("click", async () => {
    const statusKanban = dataSlides
      .map((item) => item.status)
      .lastIndexOf(false);
    if (statusKanban < 0) {
      ui.showSpinner(false);
      ui.showNotification("Queue Hari Ini Sudah Selesai", "danger", 5000);
      setTimeout(() => {
        ipcRenderer.send("app-reload");
      }, 1000);
    } else {
      ui.showPopup("scan-pengawas-pop");

      shiftAuth
        .clearWaitForAuth()
        .use("list-order")
        .addRequiredByName(
          { name: ["leader"], group: 2, alias: "LEADER" },
          true
        );

      await shiftAuth.use("list-order").waitForAuth(function () {
        ui.showSpinner();
        ui.showPopup(false);
        ui.showSection("kanban-menu");
        ui.showSpinner(false);
      });
    }
  });
});
