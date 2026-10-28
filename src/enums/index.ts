export enum Role {
  SUPER_ADMIN = "super_admin",
  ADMIN = "admin",
  EDITOR = "editor",
}

export enum RequestType {
  UPDATE = "update",
  DELETE = "delete",
}

export enum RequestStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

export enum ActivityEntity {
  PRODUCT = "product",
  REQUEST = "deletion_request",
  SALE = "sale",
}

export enum SalesPeriod {
  DAY = "day",
  WEEK = "week",
  MONTH = "month",
  YEAR = "year",
}
