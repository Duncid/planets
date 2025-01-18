let updatesEnabled = false;

export function enableUpdates() {
  updatesEnabled = true;
}

export function createDateTimeInputs(parentElement, onChangeCallback) {
  function createNumericInput(initialValue, padLength = 2, isYear = false) {
    const inp = document.createElement("input");
    inp.type = "text";
    inp.value = String(initialValue).padStart(padLength, "0");
    inp.className =
      "datetime-input input-style" + (isYear ? " datetime-input-year" : "");

    function handleKey(e) {
      let val = parseInt(inp.value, 10);
      if (isNaN(val)) val = 0;

      if (e.key === "ArrowUp") {
        val++;
        inp.value = String(val).padStart(padLength, "0");
        normalizeDateTime();
      } else if (e.key === "ArrowDown") {
        val--;
        inp.value = String(val).padStart(padLength, "0");
        normalizeDateTime();
      }
    }

    inp.addEventListener("keydown", handleKey);
    inp.addEventListener("change", normalizeDateTime);

    return inp;
  }

  const now = new Date();
  const dayInput = createNumericInput(now.getDate());
  const monthInput = createNumericInput(now.getMonth() + 1);
  const yearInput = createNumericInput(now.getFullYear(), 4, true);
  const hourInput = createNumericInput(now.getHours());
  const minuteInput = createNumericInput(now.getMinutes());

  minuteInput.addEventListener("blur", normalizeDateTime);
  hourInput.addEventListener("blur", normalizeDateTime);

  const dateContainer = document.createElement("div");
  const timeContainer = document.createElement("div");
  dateContainer.className = "input-bar";
  timeContainer.className = "input-bar";

  dateContainer.appendChild(dayInput);
  dateContainer.appendChild(document.createTextNode("/"));
  dateContainer.appendChild(monthInput);
  dateContainer.appendChild(document.createTextNode("/"));
  dateContainer.appendChild(yearInput);
  timeContainer.appendChild(hourInput);
  timeContainer.appendChild(document.createTextNode(":"));
  timeContainer.appendChild(minuteInput);

  parentElement.appendChild(dateContainer);
  parentElement.appendChild(document.createTextNode("-"));
  parentElement.appendChild(timeContainer);

  function normalizeDateTime() {
    const d = parseInt(dayInput.value, 10);
    const m = parseInt(monthInput.value, 10);
    const y = parseInt(yearInput.value, 10);
    const h = parseInt(hourInput.value, 10);
    const mm = parseInt(minuteInput.value, 10);

    const dateObj = new Date(y, m - 1, d, h, mm, 0);

    const finalY = dateObj.getFullYear();
    const finalM = dateObj.getMonth() + 1;
    const finalD = dateObj.getDate();
    const finalH = dateObj.getHours();
    const finalMM = dateObj.getMinutes();

    dayInput.value = String(finalD).padStart(2, "0");
    monthInput.value = String(finalM).padStart(2, "0");
    yearInput.value = String(finalY);
    hourInput.value = String(finalH).padStart(2, "0");
    minuteInput.value = String(finalMM).padStart(2, "0");

    onChangeCallback();
  }

  function getCurrentDateTime() {
    const d = parseInt(dayInput.value, 10);
    const m = parseInt(monthInput.value, 10);
    const y = parseInt(yearInput.value, 10);
    const h = parseInt(hourInput.value, 10);
    const mm = parseInt(minuteInput.value, 10);
    return new Date(y, m - 1, d, h, mm, 0);
  }

  function setNow() {
    const current = new Date();
    dayInput.value = String(current.getDate()).padStart(2, "0");
    monthInput.value = String(current.getMonth() + 1).padStart(2, "0");
    yearInput.value = String(current.getFullYear());
    hourInput.value = String(current.getHours()).padStart(2, "0");
    minuteInput.value = String(current.getMinutes()).padStart(2, "0");
    normalizeDateTime();
  }

  if (updatesEnabled) {
    onChangeCallback();
  }

  return { getCurrentDateTime, normalizeDateTime, setNow };
}
