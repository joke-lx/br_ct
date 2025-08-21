// /html/body/div[2]/div[2]/div[2]/div/div[5]/div[1]/div[2]/div/div[797]/div/div/div[1]/div[2]

var xpath = "/html/body/div[2]/div[2]/div[2]/div/div[5]/div[1]/div[2]/div/div[796]";
var result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
var element = result.singleNodeValue;
console.log(element);



