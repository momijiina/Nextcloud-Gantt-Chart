<?php

declare(strict_types=1);

use OCP\Util;

// Load l10n for JavaScript
$lang = '';
try {
	$userLang = \OC::$server->getL10NFactory()->findLanguage();
	if ($userLang) {
		$lang = $userLang;
	}
} catch (\Exception $e) {}
$l10nDir = __DIR__ . '/../js/l10n/';
if ($lang && $lang !== 'en' && file_exists($l10nDir . $lang . '.js')) {
	Util::addScript('gantt', 'l10n/' . $lang);
} else {
	$baseLang = strstr($lang, '_', true);
	if ($baseLang && $baseLang !== 'en' && file_exists($l10nDir . $baseLang . '.js')) {
		Util::addScript('gantt', 'l10n/' . $baseLang);
	}
}

Util::addScript('gantt', 'gantt-main');
Util::addStyle('gantt', 'gantt-main');

?>
<div id="gantt-app"></div>
