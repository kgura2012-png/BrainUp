// The server also verifies the owner before exporting any data.
var migrationSettingsBeforeBackup = setExtra2;
setExtra2 = function () {
  var markup = migrationSettingsBeforeBackup.apply(this, arguments);
  if (!hosted || !NET.admin || !isOwner()) return markup;
  return markup + '<div class="bu-sr"><div><b>Резервная копия</b><small>Данные для переноса BrainUp</small></div>'
    + '<button type="button" class="bu-btn" data-migration-backup>Скачать резервную копию для переноса</button></div>';
};

document.addEventListener('click', async function (event) {
  var button = event.target.closest('[data-migration-backup]');
  if (!button || button.disabled || !hosted || !NET.admin || !isOwner()) return;
  button.disabled = true;
  try {
    var result = await NET.request('admin-backup', {});
    if (!result.ok || !result.backup) throw Error(result.error || 'Не удалось скачать копию');
    var url = URL.createObjectURL(new Blob([JSON.stringify(result.backup)], {type: 'application/json'}));
    var link = document.createElement('a');
    link.href = url;
    link.download = 'brainup-backup-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
    toast('Резервная копия скачана. Храните её в закрытом месте.');
  } catch (error) {
    toast(error.message);
  } finally {
    button.disabled = false;
  }
});
