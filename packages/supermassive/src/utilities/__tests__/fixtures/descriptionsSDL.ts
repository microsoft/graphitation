import { gql } from "../../../__testUtils__/gql";

export const descriptionsSDL = gql`
  """
  Type Description
  """
  type TypeWithDescription implements Node {
    """
    Field Description
    """
    fieldWithDescription: Int
  }

  """
  Input Description
  second line
  third line
  """
  input AdvancedInputWithDescription {
    enumField: NodeType!
  }

  """
  Enum Description
  """
  enum EnumWithDescription {
    VALUE_WITH_DESCRIPTION
  }
  """
  Directive Description
  """
  directive @i18n(locale: String) on QUERY
`;
