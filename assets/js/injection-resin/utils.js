exports.renderQueue = (datas, slideId = 3) => {
  const slider_kanban_menu = document.querySelector("#slider-kanban-menu");
  slider_kanban_menu.innerHTML = "";
  let html = "";
  const { status, data, error } = datas;
  if (status) {
    try {
      data.map((item, index) => {
        let cardTap = "";
        if (
          item.status &&
          item.total.pcs - item.total.ng >= item.summary.plan
        ) {
          cardTap += `<div class="card-tap done" disabled id="${item.id}">`;
        } else {
          cardTap += `<div class="card-tap" id="${item.id}">`;
        }
        let cardBody = "";
        cardBody += `
        <div class="print-tap-id-card-top">${index + 1}</div>
              <div class="print-tap-id-card">
                ${item.part.name}
              </div>
              <div class="print-tap-id-card-bottom">Shift ${
                item.shift.number
              }</div>
        `;
        cardTap += `${cardBody} </div>`;
        html += cardTap;
      });
      slider_kanban_menu.innerHTML += html;
    } catch (error) {
      console.error(error);
    }
  } else {
    slider_kanban_menu.innerHTML += `<div class="error-queue">Antrian order hari ini belum tersedia</div>`;
  }
  try {
    let slideIndex = slideId;
    showSlides(slideIndex);

    function showSlides(n) {
      let slides = slider_kanban_menu.children;

      if (n > slides.length) {
        slideIndex = 3;
      }
      if (n < 3) {
        slideIndex = slides.length;
      }

      for (let slide of slides) {
        slide.style.display = "none";
      }

      slides[slideIndex - 3].style.display = "block";
      slides[slideIndex - 2].style.display = "block";
      slides[slideIndex - 1].style.display = "block";
    }
    const previous = document.querySelector(".previous");
    const next = document.querySelector(".next");

    next.addEventListener("click", function () {
      showSlides((slideIndex += 1));
    });

    previous.addEventListener("click", function () {
      showSlides((slideIndex -= 1));
    });
  } catch (error) {
    // console.error(error);
  }
};

function generateRowCol(
  chunk,
  data,
  replaces = [],
  cols,
  attrs = "mt-3",
  makeOddRows = true
) {
  const len = data.length;
  let htmlStr = "";

  for (let idx = 0; idx < len; idx++) {
    const item = data[idx];

    if (idx % cols == 0) {
      if (idx > 0) {
        htmlStr += `</div>`;
      }

      htmlStr += `<div class="row ${attrs}">`;
    }

    let tmp = chunk;

    for (const key of replaces) {
      const regexp = new RegExp("{{_" + key.toUpperCase() + "_}}", "gm");
      tmp = tmp.replace(regexp, item[key]);
    }

    htmlStr += `<div class="col">${tmp}</div>`;
  }

  if (len % 2 && makeOddRows && cols > 1) {
    htmlStr += `<div class="col"></div>`;
  }

  htmlStr += `</div>`;

  return htmlStr;
}

function generateNgMenu(data) {
  try {
    const numOfCols = [1, 1];

    let idx = 0;
    const container = $(".ng-menus");
    const catContainer = $(".ng-category");

    const categories = (function () {
      const tmp = [];
      for (const key in data) {
        tmp.push({ ...data[key].category });
      }

      return tmp;
    })();

    const htmlCategory = generateRowCol(
      `<button class="btn btn-block btn-lg py-5 btn-light border border-dark font-weight-bold text-wrap ng-category-button" data-ng-category="{{_ID_}}">{{_NAME_}}</button>`,
      categories,
      ["id", "name"],
      2,
      "mt-2"
    );

    for (const tmp of data) {
      const htmlStr = generateRowCol(
        `<button class="btn btn-block btn-lg btn-light border border-dark text-wrap ng-item-button" data-ng-id="{{_ID_}}" id="{{_ID_}}">{{_NAME_}}</button>`,
        tmp.item,
        ["id", "name"],
        2,
        "mt-2"
      );

      container.append(
        `<div class="col ng-category-${tmp.category.id}">${htmlStr}</div>`
      );
    }
  } catch (error) {
    // console.error(error);
  }
}

exports.generateSCWMenu = (data) => {
  try {
    const numOfCols = [3, 2, 1, 2, 2, 2];
    const headingElement = document.querySelectorAll(".heading-scw-content");
    [...headingElement].map((item, index) => {
      if (data[index]?.category.id) {
        item.innerHTML = data[index].category.name;
        item.id = data[index].category.id;
      }
    });
    data.map((tmp, index) => {
      const htmlStr = generateRowCol(
        `<button class="btn btn-block btn-light scw-item-button selectable border border-dark text-wrap scw-confirm-reason" data-select-group="scw-item" data-scw-id="{{_ID_}}"  
        style="max-width:220px;max-height:150px;min-width:130px;min-height:45px;margin-top:1px;margin-left:1px;margin-right:1;font-size:13px;font-weight:530">{{_NAME_}}</button>`,
        tmp.abnormalityReason,
        ["id", "name"],
        numOfCols[index],
        "mt-1"
      );

      $(".scw-menu-col-" + index).html(htmlStr);
    });
  } catch (error) {
    console.error(error);
  }
};
