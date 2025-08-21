// 构建有序列表  使用js在浏览器创建dom
const ol = document.createElement('ol');
ol.style.fontFamily = 'system-ui, sans-serif';
ol.style.lineHeight = '1.6';

items.forEach(item => {
  const li = document.createElement('li');
  const link = document.createElement('a');
  
  link.href = item.link;
  link.textContent = item.title;
  link.target = '_blank';
  link.style.textDecoration = 'none';
  link.style.color = '#00a1d6';
  link.style.fontWeight = '500';
  
  li.style.marginBottom = '12px';
  li.appendChild(link);
  ol.appendChild(li);
});
document.body.prepend(ol);