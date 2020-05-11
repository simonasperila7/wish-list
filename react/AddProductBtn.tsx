/* eslint-disable no-console */
import React, { FC, useState, useContext } from 'react'
import { ProductContext } from 'vtex.product-context'
import { Button, ToastContext } from 'vtex.styleguide'
import { compose, graphql, useApolloClient } from 'react-apollo'
import { injectIntl, WrappedComponentProps, defineMessages } from 'react-intl'
import userProfile from './queries/userProfile.gql'
import checkItem from './queries/checkItem.gql'
import addToList from './queries/addToList.gql'
import removeFromList from './queries/removeFromList.gql'
import styles from './styles.css'
import { useRuntime } from 'vtex.render-runtime'

let isAuthenticated = false
const productCheck = {}
const defaultValues = {
  LIST_NAME: 'Wishlist',
}

const messages = defineMessages({
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

const AddBtn: FC<any & WrappedComponentProps> = ({
  data: { getSession },
  intl,
}: any) => {
  const [state, setState] = useState<any>({
    isLoading: false,
    isWishlisted: false,
  })
  
  const { navigate, history } = useRuntime()
  const client = useApolloClient()

  const toastMessage = (messsageKey: string) => {
    let action: any = undefined

    if (messsageKey === 'notLogged') {
      action = {
        label: intl.formatMessage(messages.login),
        onClick: () =>
          navigate({
            page: 'store.login',
            query: `returnUrl=${encodeURIComponent(history.location.pathname)}`,
          }),
      }
    }

    showToast({
      message: intl.formatMessage(messages[messsageKey]),
      action,
    })
  }
  const { showToast } = useContext(ToastContext)

  const { isLoading, isWishlisted } = state

  if (!!getSession?.profile && !isAuthenticated) {
    isAuthenticated = true
  }

  const { product } = useContext(ProductContext) as any

  // console.log('PRODUCT =>', product)

  const handleCheck = async variables => {
    const { data } = await client.query({
      query: checkItem,
      variables,
    })
    if (data?.checkList?.inList) {
      setState({
        ...state,
        isWishlisted: data.checkList.inList,
      })
    }
    console.log('Check item ===>', data, variables)
  }

  if (isAuthenticated && product && !productCheck[product.productId]) {
    console.log(`Check if user has the product ${product.productId} wishlisted`)
    productCheck[product.productId] = product
    handleCheck({
      shopperId: getSession.profile.id,
      productId: product.productId,
    })
  }

  console.log('Hello Add to Wishlist Button!', state)
  const handleAddProductClick = e => {
    e.preventDefault()
    e.stopPropagation()
    console.log('Clicked')
    if (isAuthenticated) {
      setState({
        ...state,
        isLoading: true,
      })
      if (!isWishlisted) {
        console.log('VARIABLES =>', {
          listItem: {
            productId: product.productId,
            title: product.productName,
          },
          shopperId: getSession.profile.id,
          name: defaultValues.LIST_NAME,
        })
        client
          .mutate({
            mutation: addToList,
            variables: {
              listItem: {
                productId: product.productId,
                title: product.productName,
              },
              shopperId: getSession.profile.id,
              name: defaultValues.LIST_NAME,
            },
          })
          .then((data: any) => {
            setState({
              ...state,
              isLoading: false,
              isWishlisted: data.addToList,
            })
          })
      } else {
        console.log('VARIABLES =>', {
          id: isWishlisted,
          shopperId: getSession.profile.id,
          name: defaultValues.LIST_NAME,
        })
        client
          .mutate({
            mutation: removeFromList,
            variables: {
              id: isWishlisted,
              shopperId: getSession.profile.id,
              name: defaultValues.LIST_NAME,
            },
          })
          .then(() => {
            setState({
              ...state,
              isLoading: false,
              isWishlisted: false,
            })
          })
      }
    } else {
      toastMessage('notLogged')
    }
  }
  return (
    <div>
      <Button
        variation="tertiary"
        onClick={handleAddProductClick}
        isLoading={isLoading}
      >
        <span
          className={`${isWishlisted ? styles.fill : styles.outline} ${
            styles.iconSize
          }`}
        ></span>
      </Button>
    </div>
  )
}

export default injectIntl(
  compose(
    graphql(userProfile, {
      options: {
        ssr: false,
      },
    })
  )(AddBtn)
)
