ALTER TABLE `pt_packages` ADD `paymentAmount` int;
ALTER TABLE `pt_packages` ADD `unpaidAmount` int;
ALTER TABLE `pt_packages` ADD `paymentMethod` enum('현금영수증','이체','지역화폐','카드');
ALTER TABLE `pt_packages` ADD `paymentMemo` text;
