const __basedir = process.cwd();
const ui = require(__basedir + "/assets/js/lib/__ui.js");
const helper = require(__basedir + "/class/helper.class.js");

ui.ready(function () {
  let insertId;
  document
    .querySelector("#breakTimer")
    .addEventListener("click", async function () {
      const bodySend = {
        shiftId: shift.details?.id,
        start: helper.formatDate(new Date()),
      };
      const { data, status, error } = await api.startBreak(bodySend);
      if (status) {
        ui.showSection("break");
        document.querySelector(".shift-break-duration-plan").innerHTML =
          helper.msToHms(shift.breaks.totalDuration());
        // if break time still under planned time, pause production timer
        if (timer.use("shift-break").value() < shift.breaks.totalDuration()) {
          timer.use("production").pause();
        }
        timer.use("shift-break").start();
        insertId = data.insertId;
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
          timer.use("shift-break").pause();
          // resume production timer if it's paused
          if (!timer.use("production").status()) {
            timer.use("production").start();
          }
          ui.showSection("injection-resin-menu");
          ui.showSpinner(false);
        });
      } else {
        ui.showNotification(error, "danger", 5000);
      }
    });
});
