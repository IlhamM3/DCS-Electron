const __basedir = process.cwd();
const ui = require(__basedir + "/assets/js/lib/__ui");
const rfid = require("@iqrok/pcsclite.helper");

let isRFIDReady = false;
/******************* RFID MIFARE *********************/
// check if pcscd is available or not
if (rfid) {
  // on card inserted, run card reading
  rfid.on("ready", (protocol) => {
    isRFIDReady = true;
  });

  rfid.on("removed", (protocol) => {
    isRFIDReady = false;
  });
}

/******************* FUNCTIONS *********************/

/***************** RFID EMPLOYE WRITE POSITION ************************/
ui.ready(async function () {
  const dropdown_position = document.querySelector("#dropdown-position");
  const dropdown_EmployeeName = document.querySelector(
    "#dropdown-employee-name"
  );

  let dropdownPosition;
  const renderEmpPosition = (selector, datas) => {
    datas.map((data) => {
      selector.innerHTML += `<option value="" id="${data?.id}" class="dd-position"> ${data?.name} </option>`;
    });
  };

  const getPosition = () => {
    gEvents.on("employeePosition", (data) => {
      dropdownPosition = data;
      renderEmpPosition(dropdown_position, dropdownPosition);
    });
  };
  await getPosition();

  // let dropdown_Position;
  let selectPosition = [];
  let idPosition;
  let dropdownEmployeeName;
  dropdown_position.addEventListener("click", async (e) => {
    const item = e.target;
    const id = item.id;
    if (item.classList.contains("dd-position")) {
      selectPosition = dropdownPosition.filter((list) => {
        return list.id === Number(id);
      });
      ui.showSpinner();
      const wrapper = [...dropdown_position.children];
      wrapper.map(
        (item) =>
          item.classList.contains("active") && item.classList.remove("active")
      );
      item.classList.toggle("active");

      idPosition = selectPosition[0].id;
      namePosition = selectPosition[0].name;
    }

    /***************** RFID EMPLOYEE WRITE NAME EMPLOYEE ************************/
    const bodySend = {
      postId: idPosition,
    };
    const responEmployee = await api.getEmployeeName(bodySend);
    dropdownEmployeeName = responEmployee.data;

    const renderNameEmploye = (selector, datas) => {
      selector.innerHTML = "";
      selector.innerHTML = `<center>-- Pilih Karyawan --</center><hr>`;
      datas.map((data) => {
        selector.innerHTML += `<option value="" id="${data?.id}" class="dd-nameEmp">${data?.name}</option>`;
      });
    };
    if (responEmployee.status) {
      renderNameEmploye(dropdown_EmployeeName, dropdownEmployeeName);
    } else {
      // const msgEmploye = ` Data Karyawan Kosong `;
      ui.showNotification(responEmployee, "danger", 5000);
      dropdown_EmployeeName.innerHTML = "";
      dropdown_EmployeeName.innerHTML = `<center>-- Pilih Karyawan --</center><hr>`;
    }
    ui.showSpinner(false);
  });

  // get name employee from position dropdown if click position
  let selectNameEmp = [];
  let idNameEmp;
  dropdown_EmployeeName.addEventListener("click", async (e) => {
    const itemm = e.target;
    const id_name = itemm.id;
    if (itemm.classList.contains("dd-nameEmp")) {
      selectNameEmp = dropdownEmployeeName.filter((list) => {
        return list.id === id_name;
      })[0];

      const wrapper = [...dropdown_EmployeeName.children];
      wrapper.map(
        (item) =>
          item.classList.contains("active") && item.classList.remove("active")
      );
      itemm.classList.toggle("active");
      const empName = document.querySelector("#selected-employe");
      empName.innerText =
        selectNameEmp.position.name + " : " + selectNameEmp.name;
    }
    // console.log("employee", selectNameEmp);
  });

  //back in section rfid employee
  const btnBack = document.querySelector(".btn-main-rfid-menu");
  btnBack.addEventListener("click", () => {
    window.location.reload();
  });

  //write rfid employe btn OK
  const writeRfidEmployee = document.querySelector(".btn-ok-rfid-write");
  writeRfidEmployee.addEventListener("click", async () => {
    if (!isRFIDReady) {
      ui.showNotification("Card is not present", "danger", 2000);
      ui.showSpinner();
      return;
    }

    // clear current sector by writing each block with 0x00
    const _clearPayload = [];
    for (let index = 0; index < 3 * 0x10; index++) {
      _clearPayload.push(0);
    }

    const clear = await rfid.writeBlocks(_clearPayload);

    // write card with JSON
    const input = JSON.stringify({
      id: selectNameEmp.id,
    });

    const writeEmployee = await rfid.writeBlocks(input);

    if (writeEmployee != "false") {
      ui.showSpinner(false);
      const msg = `Write RFID Employee <b>Success</b>`;
      ui.showNotification(msg, "success");
    } else {
      ui.showSpinner(false);
      const msgg = `Write RFID Employee <b>Failed</b>`;
      ui.showNotification(msgg, "danger");
    }
    ui.showSpinner(false);
    ui.showPopup(false);
  });
});
