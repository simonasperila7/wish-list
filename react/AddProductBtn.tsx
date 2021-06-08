/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-use-before-define */
import React, {
  FC,
  useState,
  useContext,
  useEffect,
  SyntheticEvent,
} from 'react'
import PropTypes from 'prop-types'
import { useMutation, useLazyQuery } from 'react-apollo'
import { defineMessages, useIntl } from 'react-intl'
import { ProductContext } from 'vtex.product-context'
import { Button, ToastContext } from 'vtex.styleguide'
import { useRuntime, NoSSR } from 'vtex.render-runtime'
import { useCssHandles } from 'vtex.css-handles'
import { usePixel } from 'vtex.pixel-manager'

import { getSession } from './modules/session'
import storageFactory from './utils/storage'
import checkItem from './queries/checkItem.gql'
import addToList from './queries/addToList.gql'
import removeFromList from './queries/removeFromList.gql'
import styles from './styles.css'

const localStore: any = storageFactory(() => sessionStorage)
const CSS_HANDLES = ['wishlistIconContainer', 'wishlistIcon'] as const

type AddBtnProps = {
  toastURL: string
}

let isAuthenticated =
  JSON.parse(String(localStore.getItem('wishlist_isAuthenticated'))) ?? false
let shopperId = localStore.getItem('wishlist_shopperId') ?? null
let addAfterLogin = localStore.getItem('wishlist_addAfterLogin') ?? null
let wishListed: any =
  JSON.parse(localStore.getItem('wishlist_wishlisted')) ?? []

const productCheck: {
  [key: string]: { isWishlisted: boolean; wishListId: string }
} = {}
const defaultValues = {
  LIST_NAME: 'Wishlist',
}

const messages: {
  [key: string]: { defaultMessage: string; id: string }
} = defineMessages({
  addButton: {
    defaultMessage: '',
    id: 'store/wishlist.addButton',
  },
  seeLists: {
    defaultMessage: '',
    id: 'store/wishlist-see-lists',
  },
  productAddedToList: {
    defaultMessage: '',
    id: 'store/wishlist-product-added-to-list',
  },
  addProductFail: {
    defaultMessage: '',
    id: 'store/wishlist-add-product-fail',
  },
  listNameDefault: {
    defaultMessage: '',
    id: 'store/wishlist-default-list-name',
  },
  login: {
    defaultMessage: '',
    id: 'store/wishlist-login',
  },
  notLogged: {
    defaultMessage: '',
    id: 'store/wishlist-not-logged',
  },
})

const useSessionResponse = () => {
  const [session, setSession] = useState()
  const sessionPromise = getSession()

  useEffect(() => {
    if (!sessionPromise) {
      return
    }

    sessionPromise.then(sessionResponse => {
      const { response } = sessionResponse

      setSession(response)
    })
  }, [sessionPromise])

  return session
}

const unify = (arr: any) => {
  const obj: any = {}
  for (let i = 0; i < arr.length; i++) {
    obj[arr[i]] = true
  }
  return Object.getOwnPropertyNames(obj)
}

const addWishlisted = (productId: any) => {
  if (wishListed.indexOf(productId) === -1) {
    wishListed.push(productId)
  }
  wishListed = unify(wishListed)
  localStore.setItem('wishlist_wishlisted', JSON.stringify(wishListed))
}

const AddBtn: FC<AddBtnProps> = ({ toastURL = '/account/#wishlist' }) => {
  const intl = useIntl()
  const [state, setState] = useState<any>({
    isLoading: true,
    isWishlistPage: null,
  })

  const [removeProduct, { loading: removeLoading }] = useMutation(
    removeFromList,
    {
      onCompleted: () => {
        const [productId] = String(product.productId).split('-')
        if (productCheck[productId]) {
          productCheck[productId] = {
            isWishlisted: false,
            wishListId: '',
          }
        }

        wishListed = unify(wishListed)

        const pos = wishListed.findIndex((item: string) => item === productId)

        if (pos !== -1) {
          wishListed.splice(pos, 1)
          localStore.setItem('wishlist_wishlisted', JSON.stringify(wishListed))
        }

        setState({
          ...state,
          isWishlistPage: false,
        })
      },
    }
  )
  const { navigate, history, route, account } = useRuntime()
  const { push } = usePixel()
  const handles = useCssHandles(CSS_HANDLES)
  const { showToast } = useContext(ToastContext)
  const { selectedItem, product } = useContext(ProductContext) as any
  const sessionResponse: any = useSessionResponse()
  const [handleCheck, { data, loading, called }] = useLazyQuery(checkItem)

  const [productId] = String(product?.productId).split('-')

  const toastMessage = (messsageKey: string, linkWishlist: string) => {
    let action: any
    if (messsageKey === 'notLogged') {
      action = {
        label: intl.formatMessage(messages.login),
        onClick: () =>
          navigate({
            page: 'store.login',
            query: `returnUrl=${encodeURIComponent(
              history?.location?.pathname
            )}`,
          }),
      }
    }
    if (messsageKey === 'productAddedToList') {
      action = {
        label: intl.formatMessage(messages.seeLists),
        onClick: () =>
          navigate({
            to: linkWishlist,
            fetchPage: true,
          }),
      }
    }

    showToast({
      message: intl.formatMessage(messages[messsageKey]),
      action,
    })
  }

  const [addProduct, { loading: addLoading, error: addError }] = useMutation(
    addToList,
    {
      onCompleted: (res: any) => {
        productCheck[productId] = {
          wishListId: res.addToList,
          isWishlisted: true,
        }
        addWishlisted(productId)
        toastMessage('productAddedToList', toastURL)
      },
    }
  )

  if (addError) {
    toastMessage('addProductFail', toastURL)
  }

  if (sessionResponse) {
    isAuthenticated =
      sessionResponse?.namespaces?.profile?.isAuthenticated?.value === 'true'
    shopperId = sessionResponse?.namespaces?.profile?.email?.value ?? null

    localStore.setItem(
      'wishlist_isAuthenticated',
      JSON.stringify(isAuthenticated)
    )
    localStore.setItem('wishlist_shopperId', String(shopperId))
    if (!isAuthenticated && !shopperId) {
      if (localStore.getItem('wishlist_wishlisted')) {
        localStore.removeItem('wishlist_wishlisted')
      }
    }
  }

  const { isWishlistPage } = state

  if (!product) return null

  if (isWishlistPage === null && product?.wishlistPage) {
    setState({
      ...state,
      isWishlistPage: true,
    })
  }

  const getIdFromList = (list: string, item: any) => {
    const pos = item.listNames.findIndex((listName: string) => {
      return list === listName
    })
    return item.listIds[pos]
  }

  if (isAuthenticated && product && !called) {
    if (isAuthenticated && addAfterLogin && addAfterLogin === productId) {
      addProduct({
        variables: {
          listItem: {
            productId,
            title: product.productName,
          },
          shopperId,
          name: defaultValues.LIST_NAME,
        },
      })
      addAfterLogin = null
      localStore.removeItem('wishlist_addAfterLogin')
    } else {
      handleCheck({
        variables: {
          shopperId: String(shopperId),
          productId,
        },
      })
    }
  }
  const checkFill = () => {
    return sessionResponse?.namespaces?.profile?.isAuthenticated?.value ===
      'false'
      ? false
      : wishListed.findIndex((item: string) => item === productId) !== -1 ||
          productCheck[productId]?.isWishlisted ||
          isWishlistPage
  }

  const handleAddProductClick = (e: SyntheticEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (isAuthenticated) {
      const pixelEvent: any = {
        list: route?.canonicalPath?.replace('/', ''),
        items: {
          product,
          selectedItem,
          account
        }
      }

      if (checkFill()) {
        removeProduct({
          variables: {
            id: productCheck[productId].wishListId,
            shopperId,
            name: defaultValues.LIST_NAME,
          },
        })
        pixelEvent.event = 'removeToWishlist'
      } else {
        addProduct({
          variables: {
            listItem: {
              productId,
              title: product.productName,
              sku: selectedItem.itemId
            },
            shopperId,
            name: defaultValues.LIST_NAME,
          },
        })
        pixelEvent.event = 'addToWishlist'
      }
      
      push(pixelEvent)
    } else {
      localStore.setItem('wishlist_addAfterLogin', String(productId))
      toastMessage('notLogged', toastURL)
    }
  }

  if (
    data?.checkList?.inList &&
    (!productCheck[productId] || productCheck[productId].wishListId === null)
  ) {
    const itemWishListId = getIdFromList(
      defaultValues.LIST_NAME,
      data.checkList
    )

    productCheck[productId] = {
      isWishlisted: data.checkList.inList,
      wishListId: itemWishListId,
    }

    if (data.checkList.inList && wishListed.indexOf(productId) === -1) {
      addWishlisted(productId)
    }
  } else if (
    data?.checkList?.inList === false &&
    wishListed.length !== 0 &&
    wishListed.indexOf(productId) !== -1
  ) {
    const indexWishListed = wishListed.indexOf(productId)
    wishListed.splice(indexWishListed, 1)
    localStore.setItem('wishlist_wishlisted', JSON.stringify(wishListed))
  }

  return (
    <NoSSR>
      <div className={handles.wishlistIconContainer}>
        <Button
          variation="tertiary"
          onClick={handleAddProductClick}
          isLoading={loading || addLoading || removeLoading}
        >
          <span
            className={`${handles.wishlistIcon} ${
              checkFill() ? styles.fill : styles.outline
            } ${styles.iconSize}`}
          />
        </Button>
      </div>
    </NoSSR>
  )
}

AddBtn.propTypes = {
  toastURL: PropTypes.string.isRequired,
}

export default AddBtn
