import { A, D, O, F, pipe, B, flow, N } from "@mobily/ts-belt";

const Database = {
  products: {
    "001": {
      name: "Cola",
      price: 45,
    },
    "002": {
      name: "Royal",
      price: 50,
    },
    "003": {
      name: "Sprite",
      price: 55,
    },
    "004": {
      name: "Fanta",
      price: 60,
    },
    "005": {
      name: "Lemon Tea",
      price: 35,
    },
  },
};

type IDatabase = {
  products: {
    [key: string]: {
      name: string;
      price: number;
    };
  };
};

const cart = ["003", "002", "003", "003", "004", "006"];

type FormattedOrder = {
  id: string;
  name: string;
  originalPrice: number;
  discountedPrice: number;
  quantity: number;
  activatedOfCoupon: string[];
};

const groupByCart = (database: IDatabase) => (itemIds: string[]) =>
  pipe(
    itemIds,
    A.filterMap((itemId) =>
      pipe(
        O.fromNullable(database.products[itemId]),
        O.map(D.set("id", itemId))
      )
    ),
    A.groupBy((item) => item.id),
    D.map((groupItem) => ({
      id: groupItem![0].id,
      name: groupItem![0].name,
      originalPrice: groupItem![0].price,
      discountedPrice: groupItem![0].price,
      quantity: groupItem!.length,
      activatedOfCoupon: [] as string[],
    })),
    D.values
  );

const couponOne = (orders: ReadonlyArray<FormattedOrder>) =>
  pipe(
    orders,
    A.partition(flow(D.getUnsafe("quantity"), N.gte(2))),
    ([canDiscountedOrders, notDiscountedOrders]) =>
      pipe(
        canDiscountedOrders,
        A.map((order) => [
          pipe(
            order,
            D.updateUnsafe("quantity", (quantity) => Math.floor(quantity / 2)),
            D.updateUnsafe(
              "activatedOfCoupon",
              A.append("couponOne-notDiscounted")
            )
          ),
          pipe(
            order,
            D.updateUnsafe("quantity", (quantity) => Math.floor(quantity / 2)),
            D.updateUnsafe("discountedPrice", N.divide(2)), // 折價 可以連續折價
            D.updateUnsafe(
              "activatedOfCoupon",
              A.append("couponOne-discounted")
            )
          ),
          ...pipe(
            order.quantity % 2 === 1,
            B.ifElse(
              F.always([pipe(order, D.updateUnsafe("quantity", F.always(1)))]),
              F.always([])
            )
          ),
        ]),
        A.flat,
        A.concat(notDiscountedOrders)
      )
  );

const canTriggerCouponTwo = flow(
  A.reduce(0, (acc, order: FormattedOrder) =>
    F.ifElse(
      order,
      flow(
        D.getUnsafe("activatedOfCoupon"),
        D.getUnsafe("length"),
        F.equals(0)
      ),
      F.always(acc + D.getUnsafe(order, "quantity")),
      F.always(acc)
    )
  ),
  N.gte(3)
);

const couponTwo = (orders: ReadonlyArray<FormattedOrder>) =>
  B.ifElse(
    canTriggerCouponTwo(orders),
    F.always(
      pipe(
        orders,
        A.partition(
          flow(
            D.getUnsafe("activatedOfCoupon"),
            D.getUnsafe("length"),
            F.equals(0)
          )
        ),
        ([canDiscountedOrders, notDiscountedOrders]) =>
          pipe(
            canDiscountedOrders,
            A.map(
              flow(
                D.updateUnsafe("discountedPrice", N.subtract(5)),
                D.updateUnsafe("activatedOfCoupon", A.append("couponTwo"))
              )
            ),
            A.concat(notDiscountedOrders)
          )
      )
    ),
    F.always(orders)
  );

const applyCoupon = (database: IDatabase) => (cart: string[]) =>
  pipe(cart, groupByCart(database), couponOne, couponTwo);

const checkout = (database: IDatabase) => (cart: string[]) =>
  pipe(
    cart,
    applyCoupon(database),
    A.reduce(0, (acc, order) => acc + order.discountedPrice * order.quantity)
  );
