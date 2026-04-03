ALTER TABLE `Subscription`
  MODIFY `provider` ENUM('STRIPE', 'PAYPAL', 'MANUAL') NOT NULL;
