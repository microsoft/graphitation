export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = {
  [K in keyof T]: T[K];
};
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]?: Maybe<T[SubKey]>;
};
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & {
  [SubKey in K]: Maybe<T[SubKey]>;
};
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  JSDependency: any;
  JSON: any;
  ReactFlightComponent: any;
  ReactFlightProps: any;
};

export type Actor = {
  address?: Maybe<StreetAddress>;
  allPhones?: Maybe<Array<Maybe<Phone>>>;
  birthdate?: Maybe<Date>;
  emailAddresses?: Maybe<Array<Maybe<Scalars["String"]>>>;
  firstName?: Maybe<Scalars["String"]>;
  friends?: Maybe<FriendsConnection>;
  hometown?: Maybe<Page>;
  id: Scalars["ID"];
  lastName?: Maybe<Scalars["String"]>;
  name?: Maybe<Scalars["String"]>;
  nameRenderable?: Maybe<UserNameRenderable>;
  nameRenderer?: Maybe<UserNameRenderer>;
  profilePicture?: Maybe<Image>;
  screennames?: Maybe<Array<Maybe<Screenname>>>;
  subscribeStatus?: Maybe<Scalars["String"]>;
  subscribers?: Maybe<SubscribersConnection>;
  url?: Maybe<Scalars["String"]>;
  username?: Maybe<Scalars["String"]>;
  websites?: Maybe<Array<Maybe<Scalars["String"]>>>;
};

export type ActorFirstNameArgs = {
  if?: InputMaybe<Scalars["Boolean"]>;
  unless?: InputMaybe<Scalars["Boolean"]>;
};

export type ActorFriendsArgs = {
  after?: InputMaybe<Scalars["ID"]>;
  before?: InputMaybe<Scalars["ID"]>;
  find?: InputMaybe<Scalars["String"]>;
  first?: InputMaybe<Scalars["Int"]>;
  if?: InputMaybe<Scalars["Boolean"]>;
  isViewerFriend?: InputMaybe<Scalars["Boolean"]>;
  last?: InputMaybe<Scalars["Int"]>;
  orderby?: InputMaybe<Array<InputMaybe<Scalars["String"]>>>;
  traits?: InputMaybe<Array<InputMaybe<PersonalityTraits>>>;
  unless?: InputMaybe<Scalars["Boolean"]>;
};

export type ActorNameRenderableArgs = {
  supported?: InputMaybe<Array<Scalars["String"]>>;
};

export type ActorNameRendererArgs = {
  supported?: InputMaybe<Array<Scalars["String"]>>;
};

export type ActorProfilePictureArgs = {
  preset?: InputMaybe<PhotoSize>;
  size?: InputMaybe<Array<InputMaybe<Scalars["Int"]>>>;
};

export type ActorSubscribersArgs = {
  first?: InputMaybe<Scalars["Int"]>;
};

export type ActorUrlArgs = {
  relative?: InputMaybe<Scalars["Boolean"]>;
  site?: InputMaybe<Scalars["String"]>;
};

export type ActorNameChangeInput = {
  clientMutationId?: InputMaybe<Scalars["String"]>;
  newName?: InputMaybe<Scalars["String"]>;
};

export type ActorNameChangePayload = {
  __typename?: "ActorNameChangePayload";
  actor?: Maybe<Actor>;
  clientMutationId?: Maybe<Scalars["String"]>;
};

export type ActorSubscribeInput = {
  clientMutationId?: InputMaybe<Scalars["String"]>;
  subscribeeId?: InputMaybe<Scalars["ID"]>;
};

export type ActorSubscribeResponsePayload = {
  __typename?: "ActorSubscribeResponsePayload";
  clientMutationId?: Maybe<Scalars["String"]>;
  subscribee?: Maybe<Actor>;
};

export type AllConcreteTypesImplementNode = {
  count?: Maybe<Scalars["Int"]>;
};

export type ApplicationRequestDeleteAllInput = {
  clientMutationId?: InputMaybe<Scalars["String"]>;
  deletedRequestIds?: InputMaybe<Array<InputMaybe<Scalars["ID"]>>>;
};

export type ApplicationRequestDeleteAllResponsePayload = {
  __typename?: "ApplicationRequestDeleteAllResponsePayload";
  clientMutationId?: Maybe<Scalars["String"]>;
  deletedRequestIds?: Maybe<Array<Maybe<Scalars["ID"]>>>;
};

export type CheckinSearchInput = {
  inputs?: InputMaybe<Array<InputMaybe<CheckinSearchInput>>>;
  query?: InputMaybe<Scalars["String"]>;
};

export type CheckinSearchResult = {
  __typename?: "CheckinSearchResult";
  query?: Maybe<Scalars["String"]>;
};

export type Comment = Node & {
  __typename?: "Comment";
  actor?: Maybe<Actor>;
  actorCount?: Maybe<Scalars["Int"]>;
  actors?: Maybe<Array<Maybe<Actor>>>;
  address?: Maybe<StreetAddress>;
  allPhones?: Maybe<Array<Maybe<Phone>>>;
  author?: Maybe<User>;
  backgroundImage?: Maybe<Image>;
  birthdate?: Maybe<Date>;
  body?: Maybe<Text>;
  canViewerComment?: Maybe<Scalars["Boolean"]>;
  canViewerLike?: Maybe<Scalars["Boolean"]>;
  commentBody?: Maybe<CommentBody>;
  comments?: Maybe<CommentsConnection>;
  doesViewerLike?: Maybe<Scalars["Boolean"]>;
  emailAddresses?: Maybe<Array<Maybe<Scalars["String"]>>>;
  feedback?: Maybe<Feedback>;
  firstName?: Maybe<Scalars["String"]>;
  friends?: Maybe<FriendsConnection>;
  hometown?: Maybe<Page>;
  id: Scalars["ID"];
  lastName?: Maybe<Scalars["String"]>;
  likeSentence?: Maybe<Text>;
  likers?: Maybe<LikersOfContentConnection>;
  message?: Maybe<Text>;
  name?: Maybe<Scalars["String"]>;
  profilePicture?: Maybe<Image>;
  screennames?: Maybe<Array<Maybe<Screenname>>>;
  segments?: Maybe<Segments>;
  subscribeStatus?: Maybe<Scalars["String"]>;
  subscribers?: Maybe<SubscribersConnection>;
  topLevelComments?: Maybe<TopLevelCommentsConnection>;
  tracking?: Maybe<Scalars["String"]>;
  url?: Maybe<Scalars["String"]>;
  username?: Maybe<Scalars["String"]>;
  viewerSavedState?: Maybe<Scalars["String"]>;
  websites?: Maybe<Array<Maybe<Scalars["String"]>>>;
};

export type CommentCommentBodyArgs = {
  supported: Array<Scalars["String"]>;
};

export type CommentCommentsArgs = {
  after?: InputMaybe<Scalars["ID"]>;
  before?: InputMaybe<Scalars["ID"]>;
  first?: InputMaybe<Scalars["Int"]>;
  last?: InputMaybe<Scalars["Int"]>;
  orderby?: InputMaybe<Scalars["String"]>;
};

export type CommentFirstNameArgs = {
  if?: InputMaybe<Scalars["Boolean"]>;
  unless?: InputMaybe<Scalars["Boolean"]>;
};

export type CommentFriendsArgs = {
  after?: InputMaybe<Scalars["ID"]>;
  before?: InputMaybe<Scalars["ID"]>;
  find?: InputMaybe<Scalars["String"]>;
  first?: InputMaybe<Scalars["Int"]>;
  if?: InputMaybe<Scalars["Boolean"]>;
  isViewerFriend?: InputMaybe<Scalars["Boolean"]>;
  last?: InputMaybe<Scalars["Int"]>;
  orderby?: InputMaybe<Array<InputMaybe<Scalars["String"]>>>;
  traits?: InputMaybe<Array<InputMaybe<PersonalityTraits>>>;
  unless?: InputMaybe<Scalars["Boolean"]>;
};

export type CommentLikersArgs = {
  first?: InputMaybe<Scalars["Int"]>;
};

export type CommentProfilePictureArgs = {
  preset?: InputMaybe<PhotoSize>;
  size?: InputMaybe<Array<InputMaybe<Scalars["Int"]>>>;
};

export type CommentSegmentsArgs = {
  first?: InputMaybe<Scalars["Int"]>;
};

export type CommentSubscribersArgs = {
  first?: InputMaybe<Scalars["Int"]>;
};

export type CommentTopLevelCommentsArgs = {
  first?: InputMaybe<Scalars["Int"]>;
};

export type CommentUrlArgs = {
  relative?: InputMaybe<Scalars["Boolean"]>;
  site?: InputMaybe<Scalars["String"]>;
};

export type CommentBodiesConnection = {
  __typename?: "CommentBodiesConnection";
  count?: Maybe<Scalars["Int"]>;
  edges?: Maybe<Array<Maybe<CommentBodiesEdge>>>;
  pageInfo?: Maybe<PageInfo>;
};

export type CommentBodiesEdge = {
  __typename?: "CommentBodiesEdge";
  cursor?: Maybe<Scalars["String"]>;
  node?: Maybe<CommentBody>;
  source?: Maybe<Feedback>;
};

export type CommentBody = MarkdownCommentBody | PlainCommentBody;

export type CommentCreateInput = {
  clientMutationId?: InputMaybe<Scalars["String"]>;
  feedback?: InputMaybe<CommentfeedbackFeedback>;
  feedbackId?: InputMaybe<Scalars["ID"]>;
};

export type CommentCreateResponsePayload = {
  __typename?: "CommentCreateResponsePayload";
  clientMutationId?: Maybe<Scalars["String"]>;
  comment?: Maybe<Comment>;
  feedback?: Maybe<Feedback>;
  feedbackCommentEdge?: Maybe<CommentsEdge>;
  viewer?: Maybe<Viewer>;
};

export type CommentCreateSubscriptionInput = {
  clientSubscriptionId?: InputMaybe<Scalars["String"]>;
  feedbackId?: InputMaybe<Scalars["ID"]>;
  text?: InputMaybe<Scalars["String"]>;
};

export type CommentDeleteInput = {
  clientMutationId?: InputMaybe<Scalars["String"]>;
  commentId?: InputMaybe<Scalars["ID"]>;
};

export type CommentDeleteResponsePayload = {
  __typename?: "CommentDeleteResponsePayload";
  clientMutationId?: Maybe<Scalars["String"]>;
  deletedCommentId?: Maybe<Scalars["ID"]>;
  feedback?: Maybe<Feedback>;
};

export type CommentfeedbackFeedback = {
  comment?: InputMaybe<FeedbackcommentComment>;
};

export type CommentsConnection = {
  __typename?: "CommentsConnection";
  count?: Maybe<Scalars["Int"]>;
  edges?: Maybe<Array<Maybe<CommentsEdge>>>;
  pageInfo?: Maybe<PageInfo>;
};

export type CommentsCreateInput = {
  clientMutationId?: InputMaybe<Scalars["String"]>;
  feedback?: InputMaybe<Array<InputMaybe<CommentfeedbackFeedback>>>;
  feedbackId?: InputMaybe<Scalars["ID"]>;
};

export type CommentsCreateResponsePayload = {
  __typename?: "CommentsCreateResponsePayload";
  clientMutationId?: Maybe<Scalars["String"]>;
  comments?: Maybe<Array<Maybe<Comment>>>;
  feedback?: Maybe<Array<Maybe<Feedback>>>;
  feedbackCommentEdges?: Maybe<Array<Maybe<CommentsEdge>>>;
  viewer?: Maybe<Viewer>;
};

export type CommentsDeleteInput = {
  clientMutationId?: InputMaybe<Scalars["String"]>;
  commentIds?: InputMaybe<Array<InputMaybe<Scalars["ID"]>>>;
};

export type CommentsDeleteResponsePayload = {
  __typename?: "CommentsDeleteResponsePayload";
  clientMutationId?: Maybe<Scalars["String"]>;
  deletedCommentIds?: Maybe<Array<Maybe<Scalars["ID"]>>>;
  feedback?: Maybe<Feedback>;
};

export type CommentsEdge = {
  __typename?: "CommentsEdge";
  cursor?: Maybe<Scalars["String"]>;
  node?: Maybe<Comment>;
  source?: Maybe<Feedback>;
};

export type Config = {
  __typename?: "Config";
  isEnabled?: Maybe<Scalars["Boolean"]>;
  name?: Maybe<Scalars["String"]>;
};

export type ConfigCreateSubscriptResponsePayload = {
  __typename?: "ConfigCreateSubscriptResponsePayload";
  config?: Maybe<Config>;
};

export type ConfigsConnection = {
  __typename?: "ConfigsConnection";
  edges?: Maybe<Array<Maybe<ConfigsConnectionEdge>>>;
  pageInfo?: Maybe<PageInfo>;
};

export type ConfigsConnectionEdge = {
  __typename?: "ConfigsConnectionEdge";
  node?: Maybe<Config>;
};

export enum CropPosition {
  Bottom = "BOTTOM",
  Center = "CENTER",
  Left = "LEFT",
  Right = "RIGHT",
  Top = "TOP",
}

export type CustomNameRenderer = {
  __typename?: "CustomNameRenderer";
  customField?: Maybe<Scalars["String"]>;
  user?: Maybe<User>;
};

export type Date = {
  __typename?: "Date";
  day?: Maybe<Scalars["Int"]>;
  month?: Maybe<Scalars["Int"]>;
  year?: Maybe<Scalars["Int"]>;
};

export type Entity = {
  url?: Maybe<Scalars["String"]>;
};

export type EntityUrlArgs = {
  relative?: InputMaybe<Scalars["Boolean"]>;
  site?: InputMaybe<Scalars["String"]>;
};

export enum Environment {
  Mobile = "MOBILE",
  Web = "WEB",
}

export type FakeNode = {
  __typename?: "FakeNode";
  id: Scalars["ID"];
};

export type FeedUnit = {
  actor?: Maybe<Actor>;
  actorCount?: Maybe<Scalars["Int"]>;
  feedback?: Maybe<Feedback>;
  id: Scalars["ID"];
  message?: Maybe<Text>;
  tracking?: Maybe<Scalars["String"]>;
};

export type Feedback = HasJsField &
  Node & {
    __typename?: "Feedback";
    actor?: Maybe<Actor>;
    actorCount?: Maybe<Scalars["Int"]>;
    actors?: Maybe<Array<Maybe<Actor>>>;
    address?: Maybe<StreetAddress>;
    allPhones?: Maybe<Array<Maybe<Phone>>>;
    author?: Maybe<User>;
    backgroundImage?: Maybe<Image>;
    birthdate?: Maybe<Date>;
    body?: Maybe<Text>;
    canViewerComment?: Maybe<Scalars["Boolean"]>;
    canViewerLike?: Maybe<Scalars["Boolean"]>;
    commentBodies?: Maybe<CommentBodiesConnection>;
    comments?: Maybe<CommentsConnection>;
    doesViewerLike?: Maybe<Scalars["Boolean"]>;
    emailAddresses?: Maybe<Array<Maybe<Scalars["String"]>>>;
    feedback?: Maybe<Feedback>;
    firstName?: Maybe<Scalars["String"]>;
    friends?: Maybe<FriendsConnection>;
    hometown?: Maybe<Page>;
    id: Scalars["ID"];
    js?: Maybe<Scalars["JSDependency"]>;
    lastName?: Maybe<Scalars["String"]>;
    likeSentence?: Maybe<Text>;
    likers?: Maybe<LikersOfContentConnection>;
    message?: Maybe<Text>;
    name?: Maybe<Scalars["String"]>;
    profilePicture?: Maybe<Image>;
    screennames?: Maybe<Array<Maybe<Screenname>>>;
    segments?: Maybe<Segments>;
    subscribeStatus?: Maybe<Scalars["String"]>;
    subscribers?: Maybe<SubscribersConnection>;
    topLevelComments?: Maybe<TopLevelCommentsConnection>;
    tracking?: Maybe<Scalars["String"]>;
    url?: Maybe<Scalars["String"]>;
    username?: Maybe<Scalars["String"]>;
    viewedBy?: Maybe<Array<Maybe<Actor>>>;
    viewerSavedState?: Maybe<Scalars["String"]>;
    websites?: Maybe<Array<Maybe<Scalars["String"]>>>;
  };

export type FeedbackCommentBodiesArgs = {
  after?: InputMaybe<Scalars["ID"]>;
  before?: InputMaybe<Scalars["ID"]>;
  first?: InputMaybe<Scalars["Int"]>;
  last?: InputMaybe<Scalars["Int"]>;
  orderby?: InputMaybe<Scalars["String"]>;
};

export type FeedbackCommentsArgs = {
  after?: InputMaybe<Scalars["ID"]>;
  before?: InputMaybe<Scalars["ID"]>;
  first?: InputMaybe<Scalars["Int"]>;
  last?: InputMaybe<Scalars["Int"]>;
  orderby?: InputMaybe<Scalars["String"]>;
};

export type FeedbackFirstNameArgs = {
  if?: InputMaybe<Scalars["Boolean"]>;
  unless?: InputMaybe<Scalars["Boolean"]>;
};

export type FeedbackFriendsArgs = {
  after?: InputMaybe<Scalars["ID"]>;
  before?: InputMaybe<Scalars["ID"]>;
  find?: InputMaybe<Scalars["String"]>;
  first?: InputMaybe<Scalars["Int"]>;
  if?: InputMaybe<Scalars["Boolean"]>;
  isViewerFriend?: InputMaybe<Scalars["Boolean"]>;
  last?: InputMaybe<Scalars["Int"]>;
  orderby?: InputMaybe<Array<InputMaybe<Scalars["String"]>>>;
  traits?: InputMaybe<Array<InputMaybe<PersonalityTraits>>>;
  unless?: InputMaybe<Scalars["Boolean"]>;
};

export type FeedbackJsArgs = {
  id?: InputMaybe<Scalars["String"]>;
  module: Scalars["String"];
};

export type FeedbackLikersArgs = {
  first?: InputMaybe<Scalars["Int"]>;
};

export type FeedbackProfilePictureArgs = {
  preset?: InputMaybe<PhotoSize>;
  size?: InputMaybe<Array<InputMaybe<Scalars["Int"]>>>;
};

export type FeedbackSegmentsArgs = {
  first?: InputMaybe<Scalars["Int"]>;
};

export type FeedbackSubscribersArgs = {
  first?: InputMaybe<Scalars["Int"]>;
};

export type FeedbackTopLevelCommentsArgs = {
  first?: InputMaybe<Scalars["Int"]>;
  orderBy?: InputMaybe<Array<InputMaybe<TopLevelCommentsOrdering>>>;
};

export type FeedbackUrlArgs = {
  relative?: InputMaybe<Scalars["Boolean"]>;
  site?: InputMaybe<Scalars["String"]>;
};

export type FeedbackLikeInput = {
  clientMutationId?: InputMaybe<Scalars["String"]>;
  feedbackId?: InputMaybe<Scalars["ID"]>;
};

export type FeedbackLikeInputStrict = {
  clientMutationId: Scalars["ID"];
  description?: InputMaybe<Scalars["String"]>;
  feedbackId: Scalars["ID"];
  userID: Scalars["ID"];
};

export type FeedbackLikeResponsePayload = {
  __typename?: "FeedbackLikeResponsePayload";
  clientMutationId?: Maybe<Scalars["String"]>;
  clientSubscriptionId?: Maybe<Scalars["String"]>;
  feedback?: Maybe<Feedback>;
};

export type FeedbackcommentComment = {
  feedback?: InputMaybe<CommentfeedbackFeedback>;
};

export enum FileExtension {
  Jpg = "JPG",
  Png = "PNG",
}

export type FriendsConnection = {
  __typename?: "FriendsConnection";
  count?: Maybe<Scalars["Int"]>;
  edges: Array<Maybe<FriendsEdge>>;
  pageInfo?: Maybe<PageInfo>;
};

export type FriendsEdge = {
  __typename?: "FriendsEdge";
  cursor?: Maybe<Scalars["String"]>;
  node?: Maybe<User>;
  source?: Maybe<User>;
};

export type HasJsField = {
  js?: Maybe<Scalars["JSDependency"]>;
};

export type HasJsFieldJsArgs = {
  id?: InputMaybe<Scalars["String"]>;
  module: Scalars["String"];
};

export type IdFieldIsId = {
  __typename?: "IDFieldIsID";
  id?: Maybe<Scalars["ID"]>;
};

export type IdFieldIsIdNonNull = {
  __typename?: "IDFieldIsIDNonNull";
  id: Scalars["ID"];
};

export type IdFieldIsInt = {
  __typename?: "IDFieldIsInt";
  id?: Maybe<Scalars["Int"]>;
};

export type IdFieldIsIntNonNull = {
  __typename?: "IDFieldIsIntNonNull";
  id: Scalars["Int"];
};

export type IdFieldIsListOfId = {
  __typename?: "IDFieldIsListOfID";
  id?: Maybe<Array<Maybe<Scalars["ID"]>>>;
};

export type IdFieldIsObject = {
  __typename?: "IDFieldIsObject";
  id?: Maybe<Node>;
};

export type IdFieldIsString = {
  __typename?: "IDFieldIsString";
  id?: Maybe<Scalars["String"]>;
};

export type IdFieldIsStringNonNull = {
  __typename?: "IDFieldIsStringNonNull";
  id: Scalars["String"];
};

export type IdFieldTests = {
  __typename?: "IDFieldTests";
  id?: Maybe<IdFieldIsId>;
  id_non_null?: Maybe<IdFieldIsIdNonNull>;
  int?: Maybe<IdFieldIsInt>;
  int_non_null?: Maybe<IdFieldIsIntNonNull>;
  list_of_id?: Maybe<IdFieldIsListOfId>;
  object?: Maybe<IdFieldIsObject>;
  string?: Maybe<IdFieldIsString>;
  string_non_null?: Maybe<IdFieldIsStringNonNull>;
};

export type Image = {
  __typename?: "Image";
  height?: Maybe<Scalars["Int"]>;
  test_enums?: Maybe<TestEnums | `${TestEnums}`>;
  uri?: Maybe<Scalars["String"]>;
  width?: Maybe<Scalars["Int"]>;
};

export type InputText = {
  ranges?: InputMaybe<Array<InputMaybe<Scalars["String"]>>>;
  text?: InputMaybe<Scalars["String"]>;
};

export type ItemFilterInput = {
  date?: InputMaybe<Scalars["String"]>;
};

export type ItemFilterResult = {
  __typename?: "ItemFilterResult";
  date?: Maybe<Scalars["String"]>;
};

export type LikersEdge = {
  __typename?: "LikersEdge";
  cursor?: Maybe<Scalars["String"]>;
  node?: Maybe<Actor>;
};

export type LikersOfContentConnection = {
  __typename?: "LikersOfContentConnection";
  count?: Maybe<Scalars["Int"]>;
  edges?: Maybe<Array<Maybe<LikersEdge>>>;
  pageInfo?: Maybe<PageInfo>;
};

export type LocationInput = {
  latitude?: InputMaybe<Scalars["Float"]>;
  longitude?: InputMaybe<Scalars["Float"]>;
};

export type MarkdownCommentBody = {
  __typename?: "MarkdownCommentBody";
  text?: Maybe<Text>;
};

export type MarkdownUserNameData = {
  __typename?: "MarkdownUserNameData";
  id?: Maybe<Scalars["ID"]>;
  markup?: Maybe<Scalars["String"]>;
};

export type MarkdownUserNameRenderer = HasJsField &
  UserNameRenderable & {
    __typename?: "MarkdownUserNameRenderer";
    data?: Maybe<MarkdownUserNameData>;
    js?: Maybe<Scalars["JSDependency"]>;
    markdown?: Maybe<Scalars["String"]>;
    name?: Maybe<Scalars["String"]>;
    user?: Maybe<User>;
  };

export type MarkdownUserNameRendererJsArgs = {
  id?: InputMaybe<Scalars["String"]>;
  module: Scalars["String"];
};

export type MarketPlaceSellLocation = {
  __typename?: "MarketPlaceSellLocation";
  latitude?: Maybe<Scalars["Float"]>;
  longitude?: Maybe<Scalars["Float"]>;
};

export type MarketPlaceSettings = {
  __typename?: "MarketPlaceSettings";
  categories?: Maybe<Array<Maybe<Scalars["String"]>>>;
  location?: Maybe<MarketPlaceSellLocation>;
};

export enum MarketplaceBrowseContext {
  BrowseFeed = "BROWSE_FEED",
  CategoryFeed = "CATEGORY_FEED",
}

export type MarketplaceExploreConnection = {
  __typename?: "MarketplaceExploreConnection";
  count?: Maybe<Scalars["Int"]>;
};

export type MaybeNode = FakeNode | NonNode | Story;

export type MaybeNodeInterface = {
  name?: Maybe<Scalars["String"]>;
};

export type Mutation = {
  __typename?: "Mutation";
  actorNameChange?: Maybe<ActorNameChangePayload>;
  actorSubscribe?: Maybe<ActorSubscribeResponsePayload>;
  applicationRequestDeleteAll?: Maybe<ApplicationRequestDeleteAllResponsePayload>;
  commentCreate?: Maybe<CommentCreateResponsePayload>;
  commentDelete?: Maybe<CommentDeleteResponsePayload>;
  commentsCreate?: Maybe<CommentsCreateResponsePayload>;
  commentsDelete?: Maybe<CommentsDeleteResponsePayload>;
  feedbackLike?: Maybe<FeedbackLikeResponsePayload>;
  feedbackLikeStrict?: Maybe<FeedbackLikeResponsePayload>;
  feedbackLikeSubscribe?: Maybe<FeedbackLikeResponsePayload>;
  nodeSavedState?: Maybe<NodeSavedStateResponsePayload>;
  setLocation?: Maybe<SetLocationResponsePayload>;
  storyUpdate?: Maybe<StoryUpdateResponsePayload>;
  unfriend?: Maybe<UnfriendResponsePayload>;
  viewerNotificationsUpdateAllSeenState?: Maybe<ViewerNotificationsUpdateAllSeenStateResponsePayload>;
};

export type MutationActorNameChangeArgs = {
  input?: InputMaybe<ActorNameChangeInput>;
};

export type MutationActorSubscribeArgs = {
  input?: InputMaybe<ActorSubscribeInput>;
};

export type MutationApplicationRequestDeleteAllArgs = {
  input?: InputMaybe<ApplicationRequestDeleteAllInput>;
};

export type MutationCommentCreateArgs = {
  input?: InputMaybe<CommentCreateInput>;
};

export type MutationCommentDeleteArgs = {
  input?: InputMaybe<CommentDeleteInput>;
};

export type MutationCommentsCreateArgs = {
  input?: InputMaybe<CommentsCreateInput>;
};

export type MutationCommentsDeleteArgs = {
  input?: InputMaybe<CommentsDeleteInput>;
};

export type MutationFeedbackLikeArgs = {
  input?: InputMaybe<FeedbackLikeInput>;
};

export type MutationFeedbackLikeStrictArgs = {
  input: FeedbackLikeInputStrict;
};

export type MutationFeedbackLikeSubscribeArgs = {
  input?: InputMaybe<FeedbackLikeInput>;
};

export type MutationNodeSavedStateArgs = {
  input?: InputMaybe<NodeSaveStateInput>;
};

export type MutationSetLocationArgs = {
  input?: InputMaybe<LocationInput>;
};

export type MutationStoryUpdateArgs = {
  input?: InputMaybe<StoryUpdateInput>;
};

export type MutationUnfriendArgs = {
  input?: InputMaybe<UnfriendInput>;
};

export type MutationViewerNotificationsUpdateAllSeenStateArgs = {
  input?: InputMaybe<UpdateAllSeenStateInput>;
};

export enum NameRendererContext {
  Header = "HEADER",
  Other = "OTHER",
}

export type Named = {
  name?: Maybe<Scalars["String"]>;
};

export type NeverNode = FakeNode | NonNode;

export type NewsFeedConnection = {
  __typename?: "NewsFeedConnection";
  edges?: Maybe<Array<Maybe<NewsFeedEdge>>>;
  pageInfo?: Maybe<PageInfo>;
};

export type NewsFeedEdge = {
  __typename?: "NewsFeedEdge";
  cursor?: Maybe<Scalars["String"]>;
  node?: Maybe<FeedUnit>;
  showBeeper?: Maybe<Scalars["Boolean"]>;
  sortKey?: Maybe<Scalars["String"]>;
};

export type Node = {
  actor?: Maybe<Actor>;
  actorCount?: Maybe<Scalars["Int"]>;
  actors?: Maybe<Array<Maybe<Actor>>>;
  address?: Maybe<StreetAddress>;
  allPhones?: Maybe<Array<Maybe<Phone>>>;
  author?: Maybe<User>;
  backgroundImage?: Maybe<Image>;
  birthdate?: Maybe<Date>;
  body?: Maybe<Text>;
  canViewerComment?: Maybe<Scalars["Boolean"]>;
  canViewerLike?: Maybe<Scalars["Boolean"]>;
  comments?: Maybe<CommentsConnection>;
  doesViewerLike?: Maybe<Scalars["Boolean"]>;
  emailAddresses?: Maybe<Array<Maybe<Scalars["String"]>>>;
  feedback?: Maybe<Feedback>;
  firstName?: Maybe<Scalars["String"]>;
  friends?: Maybe<FriendsConnection>;
  hometown?: Maybe<Page>;
  id: Scalars["ID"];
  lastName?: Maybe<Scalars["String"]>;
  likeSentence?: Maybe<Text>;
  likers?: Maybe<LikersOfContentConnection>;
  message?: Maybe<Text>;
  name?: Maybe<Scalars["String"]>;
  profilePicture?: Maybe<Image>;
  screennames?: Maybe<Array<Maybe<Screenname>>>;
  segments?: Maybe<Segments>;
  subscribeStatus?: Maybe<Scalars["String"]>;
  subscribers?: Maybe<SubscribersConnection>;
  topLevelComments?: Maybe<TopLevelCommentsConnection>;
  tracking?: Maybe<Scalars["String"]>;
  url?: Maybe<Scalars["String"]>;
  username?: Maybe<Scalars["String"]>;
  viewerSavedState?: Maybe<Scalars["String"]>;
  websites?: Maybe<Array<Maybe<Scalars["String"]>>>;
};

export type NodeCommentsArgs = {
  after?: InputMaybe<Scalars["ID"]>;
  before?: InputMaybe<Scalars["ID"]>;
  first?: InputMaybe<Scalars["Int"]>;
  last?: InputMaybe<Scalars["Int"]>;
  orderby?: InputMaybe<Scalars["String"]>;
};

export type NodeFirstNameArgs = {
  if?: InputMaybe<Scalars["Boolean"]>;
  unless?: InputMaybe<Scalars["Boolean"]>;
};

export type NodeFriendsArgs = {
  after?: InputMaybe<Scalars["ID"]>;
  before?: InputMaybe<Scalars["ID"]>;
  find?: InputMaybe<Scalars["String"]>;
  first?: InputMaybe<Scalars["Int"]>;
  if?: InputMaybe<Scalars["Boolean"]>;
  isViewerFriend?: InputMaybe<Scalars["Boolean"]>;
  last?: InputMaybe<Scalars["Int"]>;
  orderby?: InputMaybe<Array<InputMaybe<Scalars["String"]>>>;
  traits?: InputMaybe<Array<InputMaybe<PersonalityTraits>>>;
  unless?: InputMaybe<Scalars["Boolean"]>;
};

export type NodeLikersArgs = {
  first?: InputMaybe<Scalars["Int"]>;
};

export type NodeProfilePictureArgs = {
  preset?: InputMaybe<PhotoSize>;
  size?: InputMaybe<Array<InputMaybe<Scalars["Int"]>>>;
};

export type NodeSegmentsArgs = {
  first?: InputMaybe<Scalars["Int"]>;
};

export type NodeSubscribersArgs = {
  first?: InputMaybe<Scalars["Int"]>;
};

export type NodeTopLevelCommentsArgs = {
  first?: InputMaybe<Scalars["Int"]>;
};

export type NodeUrlArgs = {
  relative?: InputMaybe<Scalars["Boolean"]>;
  site?: InputMaybe<Scalars["String"]>;
};

export type NodeSaveStateInput = {
  clientMutationId?: InputMaybe<Scalars["String"]>;
  nodeId?: InputMaybe<Scalars["ID"]>;
};

export type NodeSavedStateResponsePayload = {
  __typename?: "NodeSavedStateResponsePayload";
  node?: Maybe<Node>;
};

export type NonNode = {
  __typename?: "NonNode";
  id?: Maybe<Scalars["String"]>;
  name?: Maybe<Scalars["String"]>;
};

export type NonNodeNoId = MaybeNodeInterface & {
  __typename?: "NonNodeNoID";
  name?: Maybe<Scalars["String"]>;
};

export type NonNodeStory = FeedUnit & {
  __typename?: "NonNodeStory";
  actor?: Maybe<Actor>;
  actorCount?: Maybe<Scalars["Int"]>;
  comments?: Maybe<CommentsConnection>;
  feedback?: Maybe<Feedback>;
  fetch_id: Scalars["ID"];
  id: Scalars["ID"];
  message?: Maybe<Text>;
  tracking?: Maybe<Scalars["String"]>;
};

export type NonNodeStoryCommentsArgs = {
  after?: InputMaybe<Scalars["ID"]>;
  before?: InputMaybe<Scalars["ID"]>;
  first?: InputMaybe<Scalars["Int"]>;
  last?: InputMaybe<Scalars["Int"]>;
  orderby?: InputMaybe<Scalars["String"]>;
};

export type Page = Actor &
  Entity &
  Node & {
    __typename?: "Page";
    actor?: Maybe<Actor>;
    actorCount?: Maybe<Scalars["Int"]>;
    actors?: Maybe<Array<Maybe<Actor>>>;
    address?: Maybe<StreetAddress>;
    allPhones?: Maybe<Array<Maybe<Phone>>>;
    author?: Maybe<User>;
    backgroundImage?: Maybe<Image>;
    birthdate?: Maybe<Date>;
    body?: Maybe<Text>;
    canViewerComment?: Maybe<Scalars["Boolean"]>;
    canViewerLike?: Maybe<Scalars["Boolean"]>;
    comments?: Maybe<CommentsConnection>;
    doesViewerLike?: Maybe<Scalars["Boolean"]>;
    emailAddresses?: Maybe<Array<Maybe<Scalars["String"]>>>;
    feedback?: Maybe<Feedback>;
    firstName?: Maybe<Scalars["String"]>;
    friends?: Maybe<FriendsConnection>;
    hometown?: Maybe<Page>;
    id: Scalars["ID"];
    lastName?: Maybe<Scalars["String"]>;
    likeSentence?: Maybe<Text>;
    likers?: Maybe<LikersOfContentConnection>;
    message?: Maybe<Text>;
    name?: Maybe<Scalars["String"]>;
    nameRenderable?: Maybe<UserNameRenderable>;
    nameRenderer?: Maybe<UserNameRenderer>;
    nameWithArgs?: Maybe<Scalars["String"]>;
    nameWithDefaultArgs?: Maybe<Scalars["String"]>;
    profilePicture?: Maybe<Image>;
    screennames?: Maybe<Array<Maybe<Screenname>>>;
    segments?: Maybe<Segments>;
    subscribeStatus?: Maybe<Scalars["String"]>;
    subscribers?: Maybe<SubscribersConnection>;
    topLevelComments?: Maybe<TopLevelCommentsConnection>;
    tracking?: Maybe<Scalars["String"]>;
    url?: Maybe<Scalars["String"]>;
    username?: Maybe<Scalars["String"]>;
    viewerSavedState?: Maybe<Scalars["String"]>;
    websites?: Maybe<Array<Maybe<Scalars["String"]>>>;
  };

export type PageCommentsArgs = {
  after?: InputMaybe<Scalars["ID"]>;
  before?: InputMaybe<Scalars["ID"]>;
  first?: InputMaybe<Scalars["Int"]>;
  last?: InputMaybe<Scalars["Int"]>;
  orderby?: InputMaybe<Scalars["String"]>;
};

export type PageFirstNameArgs = {
  if?: InputMaybe<Scalars["Boolean"]>;
  unless?: InputMaybe<Scalars["Boolean"]>;
};

export type PageFriendsArgs = {
  after?: InputMaybe<Scalars["ID"]>;
  before?: InputMaybe<Scalars["ID"]>;
  find?: InputMaybe<Scalars["String"]>;
  first?: InputMaybe<Scalars["Int"]>;
  if?: InputMaybe<Scalars["Boolean"]>;
  isViewerFriend?: InputMaybe<Scalars["Boolean"]>;
  last?: InputMaybe<Scalars["Int"]>;
  orderby?: InputMaybe<Array<InputMaybe<Scalars["String"]>>>;
  traits?: InputMaybe<Array<InputMaybe<PersonalityTraits>>>;
  unless?: InputMaybe<Scalars["Boolean"]>;
};

export type PageLikersArgs = {
  first?: InputMaybe<Scalars["Int"]>;
};

export type PageNameRenderableArgs = {
  supported?: InputMaybe<Array<Scalars["String"]>>;
};

export type PageNameRendererArgs = {
  supported?: InputMaybe<Array<Scalars["String"]>>;
};

export type PageNameWithArgsArgs = {
  capitalize: Scalars["Boolean"];
};

export type PageNameWithDefaultArgsArgs = {
  capitalize?: Scalars["Boolean"];
};

export type PageProfilePictureArgs = {
  preset?: InputMaybe<PhotoSize>;
  size?: InputMaybe<Array<InputMaybe<Scalars["Int"]>>>;
};

export type PageSegmentsArgs = {
  first?: InputMaybe<Scalars["Int"]>;
};

export type PageSubscribersArgs = {
  first?: InputMaybe<Scalars["Int"]>;
};

export type PageTopLevelCommentsArgs = {
  first?: InputMaybe<Scalars["Int"]>;
};

export type PageUrlArgs = {
  relative?: InputMaybe<Scalars["Boolean"]>;
  site?: InputMaybe<Scalars["String"]>;
};

export type PageInfo = {
  __typename?: "PageInfo";
  endCursor?: Maybe<Scalars["String"]>;
  hasNextPage?: Maybe<Scalars["Boolean"]>;
  hasPreviousPage?: Maybe<Scalars["Boolean"]>;
  startCursor?: Maybe<Scalars["String"]>;
};

export type PendingPost = {
  __typename?: "PendingPost";
  text?: Maybe<Scalars["String"]>;
};

export type PendingPostsConnection = {
  __typename?: "PendingPostsConnection";
  count?: Maybe<Scalars["Int"]>;
  edges?: Maybe<Array<Maybe<PendingPostsConnectionEdge>>>;
  pageInfo?: Maybe<PageInfo>;
};

export type PendingPostsConnectionEdge = {
  __typename?: "PendingPostsConnectionEdge";
  cursor?: Maybe<Scalars["String"]>;
  node?: Maybe<PendingPost>;
};

export enum PersonalityTraits {
  Cheerful = "CHEERFUL",
  Derisive = "DERISIVE",
  Helpful = "HELPFUL",
  Snarky = "SNARKY",
}

export type Phone = {
  __typename?: "Phone";
  isVerified?: Maybe<Scalars["Boolean"]>;
  phoneNumber?: Maybe<PhoneNumber>;
};

export type PhoneNumber = {
  __typename?: "PhoneNumber";
  countryCode?: Maybe<Scalars["String"]>;
  displayNumber?: Maybe<Scalars["String"]>;
};

export enum PhotoSize {
  Large = "LARGE",
  Small = "SMALL",
}

export type PhotoStory = FeedUnit &
  Node & {
    __typename?: "PhotoStory";
    actor?: Maybe<Actor>;
    actorCount?: Maybe<Scalars["Int"]>;
    actors?: Maybe<Array<Maybe<Actor>>>;
    address?: Maybe<StreetAddress>;
    allPhones?: Maybe<Array<Maybe<Phone>>>;
    author?: Maybe<User>;
    backgroundImage?: Maybe<Image>;
    birthdate?: Maybe<Date>;
    body?: Maybe<Text>;
    canViewerComment?: Maybe<Scalars["Boolean"]>;
    canViewerDelete?: Maybe<Scalars["Boolean"]>;
    canViewerLike?: Maybe<Scalars["Boolean"]>;
    comments?: Maybe<CommentsConnection>;
    doesViewerLike?: Maybe<Scalars["Boolean"]>;
    emailAddresses?: Maybe<Array<Maybe<Scalars["String"]>>>;
    feedback?: Maybe<Feedback>;
    firstName?: Maybe<Scalars["String"]>;
    friends?: Maybe<FriendsConnection>;
    hometown?: Maybe<Page>;
    id: Scalars["ID"];
    lastName?: Maybe<Scalars["String"]>;
    likeSentence?: Maybe<Text>;
    likers?: Maybe<LikersOfContentConnection>;
    message?: Maybe<Text>;
    name?: Maybe<Scalars["String"]>;
    photo?: Maybe<Image>;
    profilePicture?: Maybe<Image>;
    screennames?: Maybe<Array<Maybe<Screenname>>>;
    seenState?: Maybe<Scalars["String"]>;
    segments?: Maybe<Segments>;
    subscribeStatus?: Maybe<Scalars["String"]>;
    subscribers?: Maybe<SubscribersConnection>;
    topLevelComments?: Maybe<TopLevelCommentsConnection>;
    tracking?: Maybe<Scalars["String"]>;
    url?: Maybe<Scalars["String"]>;
    username?: Maybe<Scalars["String"]>;
    viewerSavedState?: Maybe<Scalars["String"]>;
    websites?: Maybe<Array<Maybe<Scalars["String"]>>>;
  };

export type PhotoStoryCommentsArgs = {
  after?: InputMaybe<Scalars["ID"]>;
  before?: InputMaybe<Scalars["ID"]>;
  first?: InputMaybe<Scalars["Int"]>;
  last?: InputMaybe<Scalars["Int"]>;
  orderby?: InputMaybe<Scalars["String"]>;
};

export type PhotoStoryFirstNameArgs = {
  if?: InputMaybe<Scalars["Boolean"]>;
  unless?: InputMaybe<Scalars["Boolean"]>;
};

export type PhotoStoryFriendsArgs = {
  after?: InputMaybe<Scalars["ID"]>;
  before?: InputMaybe<Scalars["ID"]>;
  find?: InputMaybe<Scalars["String"]>;
  first?: InputMaybe<Scalars["Int"]>;
  if?: InputMaybe<Scalars["Boolean"]>;
  isViewerFriend?: InputMaybe<Scalars["Boolean"]>;
  last?: InputMaybe<Scalars["Int"]>;
  orderby?: InputMaybe<Array<InputMaybe<Scalars["String"]>>>;
  traits?: InputMaybe<Array<InputMaybe<PersonalityTraits>>>;
  unless?: InputMaybe<Scalars["Boolean"]>;
};

export type PhotoStoryLikersArgs = {
  first?: InputMaybe<Scalars["Int"]>;
};

export type PhotoStoryProfilePictureArgs = {
  preset?: InputMaybe<PhotoSize>;
  size?: InputMaybe<Array<InputMaybe<Scalars["Int"]>>>;
};

export type PhotoStorySegmentsArgs = {
  first?: InputMaybe<Scalars["Int"]>;
};

export type PhotoStorySubscribersArgs = {
  first?: InputMaybe<Scalars["Int"]>;
};

export type PhotoStoryTopLevelCommentsArgs = {
  first?: InputMaybe<Scalars["Int"]>;
};

export type PhotoStoryUrlArgs = {
  relative?: InputMaybe<Scalars["Boolean"]>;
  site?: InputMaybe<Scalars["String"]>;
};

export type PlainCommentBody = {
  __typename?: "PlainCommentBody";
  text?: Maybe<Text>;
};

export type PlainUserNameData = {
  __typename?: "PlainUserNameData";
  id?: Maybe<Scalars["ID"]>;
  text?: Maybe<Scalars["String"]>;
};

export type PlainUserNameRenderer = HasJsField &
  UserNameRenderable & {
    __typename?: "PlainUserNameRenderer";
    data?: Maybe<PlainUserNameData>;
    js?: Maybe<Scalars["JSDependency"]>;
    name?: Maybe<Scalars["String"]>;
    plaintext?: Maybe<Scalars["String"]>;
    user?: Maybe<User>;
  };

export type PlainUserNameRendererJsArgs = {
  id?: InputMaybe<Scalars["String"]>;
  module: Scalars["String"];
};

export type PlainUserRenderer = {
  __typename?: "PlainUserRenderer";
  js?: Maybe<Scalars["JSDependency"]>;
  user?: Maybe<User>;
};

export type PlainUserRendererJsArgs = {
  id?: InputMaybe<Scalars["String"]>;
  module: Scalars["String"];
};

export type ProfilePictureOptions = {
  newName?: InputMaybe<Scalars["String"]>;
};

export type Query = {
  __typename?: "Query";
  _mutation?: Maybe<Mutation>;
  checkinSearchQuery?: Maybe<CheckinSearchResult>;
  defaultSettings?: Maybe<Settings>;
  fetch__NonNodeStory?: Maybe<NonNodeStory>;
  fetch__User?: Maybe<User>;
  items?: Maybe<ItemFilterResult>;
  maybeNode?: Maybe<MaybeNode>;
  maybeNodeInterface?: Maybe<MaybeNodeInterface>;
  me?: Maybe<User>;
  named?: Maybe<Named>;
  neverNode?: Maybe<NeverNode>;
  node?: Maybe<Node>;
  node_id_required?: Maybe<Node>;
  nodes?: Maybe<Array<Maybe<Node>>>;
  nonNodeStory?: Maybe<NonNodeStory>;
  relay_early_flush: Array<Scalars["JSDependency"]>;
  route?: Maybe<Route>;
  settings?: Maybe<Settings>;
  story?: Maybe<Story>;
  task?: Maybe<Task>;
  userOrPage?: Maybe<UserOrPage>;
  username?: Maybe<Actor>;
  usernames?: Maybe<Array<Maybe<Actor>>>;
  viewer?: Maybe<Viewer>;
};

export type QueryCheckinSearchQueryArgs = {
  query?: InputMaybe<CheckinSearchInput>;
};

export type QueryFetch__NonNodeStoryArgs = {
  input_fetch_id: Scalars["ID"];
};

export type QueryFetch__UserArgs = {
  id: Scalars["ID"];
};

export type QueryItemsArgs = {
  filter?: InputMaybe<ItemFilterInput>;
};

export type QueryNodeArgs = {
  id?: InputMaybe<Scalars["ID"]>;
};

export type QueryNode_Id_RequiredArgs = {
  id: Scalars["ID"];
};

export type QueryNodesArgs = {
  ids?: InputMaybe<Array<Scalars["ID"]>>;
};

export type QueryNonNodeStoryArgs = {
  id: Scalars["ID"];
};

export type QueryRelay_Early_FlushArgs = {
  query_name?: InputMaybe<Scalars["String"]>;
};

export type QueryRouteArgs = {
  waypoints: Array<WayPoint>;
};

export type QuerySettingsArgs = {
  environment?: InputMaybe<Environment>;
};

export type QueryTaskArgs = {
  number?: InputMaybe<Scalars["Int"]>;
};

export type QueryUserOrPageArgs = {
  id: Scalars["ID"];
};

export type QueryUsernameArgs = {
  name: Scalars["String"];
};

export type QueryUsernamesArgs = {
  names: Array<Scalars["String"]>;
};

export type Route = {
  __typename?: "Route";
  steps?: Maybe<Array<Maybe<RouteStep>>>;
};

export type RouteStep = {
  __typename?: "RouteStep";
  lat?: Maybe<Scalars["String"]>;
  lon?: Maybe<Scalars["String"]>;
  note?: Maybe<Scalars["String"]>;
};

export type Screenname = {
  __typename?: "Screenname";
  name?: Maybe<Scalars["String"]>;
  service?: Maybe<Scalars["String"]>;
};

export type Segments = {
  __typename?: "Segments";
  edges?: Maybe<SegmentsEdge>;
};

export type SegmentsEdge = {
  __typename?: "SegmentsEdge";
  node?: Maybe<Scalars["String"]>;
};

export type Settings = {
  __typename?: "Settings";
  cache_id?: Maybe<Scalars["ID"]>;
  notificationSounds?: Maybe<Scalars["Boolean"]>;
  notifications?: Maybe<Scalars["Boolean"]>;
};

export type SettingsNotificationsArgs = {
  environment?: InputMaybe<Environment>;
};

export type SimpleNamed = Named & {
  __typename?: "SimpleNamed";
  name?: Maybe<Scalars["String"]>;
};

export type Story = FeedUnit &
  MaybeNodeInterface &
  Node & {
    __typename?: "Story";
    actor?: Maybe<Actor>;
    actorCount?: Maybe<Scalars["Int"]>;
    actors?: Maybe<Array<Maybe<Actor>>>;
    address?: Maybe<StreetAddress>;
    allPhones?: Maybe<Array<Maybe<Phone>>>;
    attachments?: Maybe<Array<Maybe<StoryAttachment>>>;
    author?: Maybe<User>;
    backgroundImage?: Maybe<Image>;
    birthdate?: Maybe<Date>;
    body?: Maybe<Text>;
    canViewerComment?: Maybe<Scalars["Boolean"]>;
    canViewerDelete?: Maybe<Scalars["Boolean"]>;
    canViewerLike?: Maybe<Scalars["Boolean"]>;
    comments?: Maybe<CommentsConnection>;
    doesViewerLike?: Maybe<Scalars["Boolean"]>;
    emailAddresses?: Maybe<Array<Maybe<Scalars["String"]>>>;
    feedback?: Maybe<Feedback>;
    firstName?: Maybe<Scalars["String"]>;
    flight?: Maybe<Scalars["ReactFlightComponent"]>;
    friends?: Maybe<FriendsConnection>;
    hometown?: Maybe<Page>;
    id: Scalars["ID"];
    lastName?: Maybe<Scalars["String"]>;
    likeSentence?: Maybe<Text>;
    likers?: Maybe<LikersOfContentConnection>;
    message?: Maybe<Text>;
    name?: Maybe<Scalars["String"]>;
    profilePicture?: Maybe<Image>;
    screennames?: Maybe<Array<Maybe<Screenname>>>;
    seenState?: Maybe<Scalars["String"]>;
    segments?: Maybe<Segments>;
    subscribeStatus?: Maybe<Scalars["String"]>;
    subscribers?: Maybe<SubscribersConnection>;
    topLevelComments?: Maybe<TopLevelCommentsConnection>;
    tracking?: Maybe<Scalars["String"]>;
    url?: Maybe<Scalars["String"]>;
    username?: Maybe<Scalars["String"]>;
    viewerSavedState?: Maybe<Scalars["String"]>;
    websites?: Maybe<Array<Maybe<Scalars["String"]>>>;
  };

export type StoryCommentsArgs = {
  after?: InputMaybe<Scalars["ID"]>;
  before?: InputMaybe<Scalars["ID"]>;
  first?: InputMaybe<Scalars["Int"]>;
  last?: InputMaybe<Scalars["Int"]>;
  orderby?: InputMaybe<Scalars["String"]>;
};

export type StoryFirstNameArgs = {
  if?: InputMaybe<Scalars["Boolean"]>;
  unless?: InputMaybe<Scalars["Boolean"]>;
};

export type StoryFlightArgs = {
  component?: InputMaybe<Scalars["String"]>;
  props?: InputMaybe<Scalars["ReactFlightProps"]>;
};

export type StoryFriendsArgs = {
  after?: InputMaybe<Scalars["ID"]>;
  before?: InputMaybe<Scalars["ID"]>;
  find?: InputMaybe<Scalars["String"]>;
  first?: InputMaybe<Scalars["Int"]>;
  if?: InputMaybe<Scalars["Boolean"]>;
  isViewerFriend?: InputMaybe<Scalars["Boolean"]>;
  last?: InputMaybe<Scalars["Int"]>;
  orderby?: InputMaybe<Array<InputMaybe<Scalars["String"]>>>;
  traits?: InputMaybe<Array<InputMaybe<PersonalityTraits>>>;
  unless?: InputMaybe<Scalars["Boolean"]>;
};

export type StoryLikersArgs = {
  first?: InputMaybe<Scalars["Int"]>;
};

export type StoryProfilePictureArgs = {
  preset?: InputMaybe<PhotoSize>;
  size?: InputMaybe<Array<InputMaybe<Scalars["Int"]>>>;
};

export type StorySegmentsArgs = {
  first?: InputMaybe<Scalars["Int"]>;
};

export type StorySubscribersArgs = {
  first?: InputMaybe<Scalars["Int"]>;
};

export type StoryTopLevelCommentsArgs = {
  first?: InputMaybe<Scalars["Int"]>;
};

export type StoryUrlArgs = {
  relative?: InputMaybe<Scalars["Boolean"]>;
  site?: InputMaybe<Scalars["String"]>;
};

export type StoryAttachment = {
  __typename?: "StoryAttachment";
  cache_id: Scalars["ID"];
  styleList?: Maybe<Array<Maybe<Scalars["String"]>>>;
  target?: Maybe<Story>;
};

export type StoryCommentSearchInput = {
  limit?: InputMaybe<Scalars["Int"]>;
  offset?: InputMaybe<Scalars["Int"]>;
  text?: InputMaybe<Scalars["String"]>;
};

export type StorySearchInput = {
  limit?: InputMaybe<Scalars["Int"]>;
  offset?: InputMaybe<Scalars["Int"]>;
  text?: InputMaybe<Scalars["String"]>;
  type?: InputMaybe<StoryType | `${StoryType}`>;
};

export enum StoryType {
  Directed = "DIRECTED",
  Undirected = "UNDIRECTED",
}

export type StoryUpdateInput = {
  body?: InputMaybe<InputText>;
  clientMutationId?: InputMaybe<Scalars["String"]>;
};

export type StoryUpdateResponsePayload = {
  __typename?: "StoryUpdateResponsePayload";
  clientMutationId?: Maybe<Scalars["String"]>;
  story?: Maybe<Story>;
};

export type StreetAddress = {
  __typename?: "StreetAddress";
  city?: Maybe<Scalars["String"]>;
  country?: Maybe<Scalars["String"]>;
  postal_code?: Maybe<Scalars["String"]>;
  street?: Maybe<Scalars["String"]>;
};

export type SubscribersConnection = {
  __typename?: "SubscribersConnection";
  count?: Maybe<Scalars["Int"]>;
  edges?: Maybe<Array<Maybe<FriendsEdge>>>;
  pageInfo?: Maybe<PageInfo>;
};

export type SubscribersEdge = {
  __typename?: "SubscribersEdge";
  cursor?: Maybe<Scalars["String"]>;
  node?: Maybe<User>;
  source?: Maybe<User>;
};

export type Subscription = {
  __typename?: "Subscription";
  commentCreateSubscribe?: Maybe<CommentCreateResponsePayload>;
  configCreateSubscribe?: Maybe<ConfigCreateSubscriptResponsePayload>;
  feedbackLikeSubscribe?: Maybe<FeedbackLikeResponsePayload>;
};

export type SubscriptionCommentCreateSubscribeArgs = {
  input?: InputMaybe<CommentCreateSubscriptionInput>;
};

export type SubscriptionFeedbackLikeSubscribeArgs = {
  input?: InputMaybe<FeedbackLikeInput>;
};

export type Task = {
  __typename?: "Task";
  title?: Maybe<Scalars["String"]>;
};

export enum TestEnums {
  Mark = "mark",
  Zuck = "zuck",
}

export type Text = {
  __typename?: "Text";
  ranges?: Maybe<Array<Maybe<Scalars["String"]>>>;
  text?: Maybe<Scalars["String"]>;
};

export type TimezoneInfo = {
  __typename?: "TimezoneInfo";
  timezone?: Maybe<Scalars["String"]>;
};

export type TopLevelCommentsConnection = {
  __typename?: "TopLevelCommentsConnection";
  count?: Maybe<Scalars["Int"]>;
  edges?: Maybe<Array<Maybe<CommentsEdge>>>;
  pageInfo?: Maybe<PageInfo>;
  totalCount?: Maybe<Scalars["Int"]>;
};

export enum TopLevelCommentsOrdering {
  Chronological = "chronological",
  RankedThreaded = "ranked_threaded",
  RecentActivity = "recent_activity",
  Toplevel = "toplevel",
}

export type UnfriendInput = {
  clientMutationId?: InputMaybe<Scalars["String"]>;
  friendId?: InputMaybe<Scalars["ID"]>;
};

export type UnfriendResponsePayload = {
  __typename?: "UnfriendResponsePayload";
  actor?: Maybe<Actor>;
  clientMutationId?: Maybe<Scalars["String"]>;
  formerFriend?: Maybe<User>;
};

export type UpdateAllSeenStateInput = {
  clientMutationId?: InputMaybe<Scalars["String"]>;
  storyIds?: InputMaybe<Array<InputMaybe<Scalars["ID"]>>>;
};

export type User = Actor &
  AllConcreteTypesImplementNode &
  Entity &
  HasJsField &
  Named &
  Node & {
    __typename?: "User";
    actor?: Maybe<Actor>;
    actorCount?: Maybe<Scalars["Int"]>;
    actors?: Maybe<Array<Maybe<Actor>>>;
    address?: Maybe<StreetAddress>;
    allPhones?: Maybe<Array<Maybe<Phone>>>;
    alternate_name?: Maybe<Scalars["String"]>;
    author?: Maybe<User>;
    backgroundImage?: Maybe<Image>;
    birthdate?: Maybe<Date>;
    body?: Maybe<Text>;
    canViewerComment?: Maybe<Scalars["Boolean"]>;
    canViewerLike?: Maybe<Scalars["Boolean"]>;
    checkins?: Maybe<CheckinSearchResult>;
    comments?: Maybe<CommentsConnection>;
    count: Scalars["Int"];
    doesViewerLike?: Maybe<Scalars["Boolean"]>;
    emailAddresses?: Maybe<Array<Maybe<Scalars["String"]>>>;
    environment?: Maybe<Environment | `${Environment}`>;
    feedback?: Maybe<Feedback>;
    firstName?: Maybe<Scalars["String"]>;
    friends?: Maybe<FriendsConnection>;
    hometown?: Maybe<Page>;
    id: Scalars["ID"];
    js?: Maybe<Scalars["JSDependency"]>;
    lastName?: Maybe<Scalars["String"]>;
    likeSentence?: Maybe<Text>;
    likers?: Maybe<LikersOfContentConnection>;
    message?: Maybe<Text>;
    name?: Maybe<Scalars["String"]>;
    nameRenderable?: Maybe<UserNameRenderable>;
    nameRenderer?: Maybe<UserNameRenderer>;
    nameRendererForContext?: Maybe<UserNameRenderer>;
    nameRendererNoSupportedArg?: Maybe<UserNameRenderer>;
    nameRenderers?: Maybe<Array<Maybe<UserNameRenderer>>>;
    nearest_neighbor: User;
    neighbors?: Maybe<Array<User>>;
    parents: Array<User>;
    plainUserRenderer?: Maybe<PlainUserRenderer>;
    profilePicture?: Maybe<Image>;
    profilePicture2?: Maybe<Image>;
    profile_picture?: Maybe<Image>;
    screennames?: Maybe<Array<Maybe<Screenname>>>;
    segments?: Maybe<Segments>;
    storyCommentSearch?: Maybe<Array<Maybe<Comment>>>;
    storySearch?: Maybe<Array<Maybe<Story>>>;
    subscribeStatus?: Maybe<Scalars["String"]>;
    subscribers?: Maybe<SubscribersConnection>;
    topLevelComments?: Maybe<TopLevelCommentsConnection>;
    tracking?: Maybe<Scalars["String"]>;
    traits?: Maybe<Array<Maybe<PersonalityTraits | `${PersonalityTraits}`>>>;
    url?: Maybe<Scalars["String"]>;
    username?: Maybe<Scalars["String"]>;
    viewerSavedState?: Maybe<Scalars["String"]>;
    websites?: Maybe<Array<Maybe<Scalars["String"]>>>;
  };

export type UserCheckinsArgs = {
  environments: Array<Environment>;
};

export type UserCommentsArgs = {
  after?: InputMaybe<Scalars["ID"]>;
  before?: InputMaybe<Scalars["ID"]>;
  first?: InputMaybe<Scalars["Int"]>;
  last?: InputMaybe<Scalars["Int"]>;
  orderby?: InputMaybe<Scalars["String"]>;
};

export type UserFirstNameArgs = {
  if?: InputMaybe<Scalars["Boolean"]>;
  unless?: InputMaybe<Scalars["Boolean"]>;
};

export type UserFriendsArgs = {
  after?: InputMaybe<Scalars["ID"]>;
  before?: InputMaybe<Scalars["ID"]>;
  find?: InputMaybe<Scalars["String"]>;
  first?: InputMaybe<Scalars["Int"]>;
  if?: InputMaybe<Scalars["Boolean"]>;
  isViewerFriend?: InputMaybe<Scalars["Boolean"]>;
  last?: InputMaybe<Scalars["Int"]>;
  named?: InputMaybe<Scalars["String"]>;
  orderby?: InputMaybe<Array<InputMaybe<Scalars["String"]>>>;
  scale?: InputMaybe<Scalars["Float"]>;
  traits?: InputMaybe<Array<InputMaybe<PersonalityTraits>>>;
  unless?: InputMaybe<Scalars["Boolean"]>;
};

export type UserJsArgs = {
  id?: InputMaybe<Scalars["String"]>;
  module: Scalars["String"];
};

export type UserLikersArgs = {
  first?: InputMaybe<Scalars["Int"]>;
};

export type UserNameRenderableArgs = {
  supported?: InputMaybe<Array<Scalars["String"]>>;
};

export type UserNameRendererArgs = {
  supported?: InputMaybe<Array<Scalars["String"]>>;
};

export type UserNameRendererForContextArgs = {
  context?: InputMaybe<NameRendererContext>;
  supported: Array<Scalars["String"]>;
};

export type UserNameRenderersArgs = {
  supported?: InputMaybe<Array<Scalars["String"]>>;
};

export type UserProfilePictureArgs = {
  preset?: InputMaybe<PhotoSize>;
  size?: InputMaybe<Array<InputMaybe<Scalars["Int"]>>>;
};

export type UserProfilePicture2Args = {
  additionalParameters?: InputMaybe<Scalars["JSON"]>;
  cropPosition?: InputMaybe<CropPosition>;
  fileExtension?: InputMaybe<FileExtension>;
  options?: InputMaybe<ProfilePictureOptions>;
  preset?: InputMaybe<PhotoSize>;
  size?: InputMaybe<Array<InputMaybe<Scalars["Int"]>>>;
};

export type UserProfile_PictureArgs = {
  scale?: InputMaybe<Scalars["Float"]>;
};

export type UserSegmentsArgs = {
  first?: InputMaybe<Scalars["Int"]>;
};

export type UserStoryCommentSearchArgs = {
  query?: InputMaybe<StoryCommentSearchInput>;
};

export type UserStorySearchArgs = {
  query?: InputMaybe<StorySearchInput>;
};

export type UserSubscribersArgs = {
  first?: InputMaybe<Scalars["Int"]>;
};

export type UserTopLevelCommentsArgs = {
  first?: InputMaybe<Scalars["Int"]>;
};

export type UserUrlArgs = {
  relative?: InputMaybe<Scalars["Boolean"]>;
  site?: InputMaybe<Scalars["String"]>;
};

export type UserNameRenderable = {
  name?: Maybe<Scalars["String"]>;
};

export type UserNameRenderer =
  | CustomNameRenderer
  | MarkdownUserNameRenderer
  | PlainUserNameRenderer;

export type UserOrPage = Page | User;

export type Viewer = {
  __typename?: "Viewer";
  account_user?: Maybe<User>;
  actor?: Maybe<Actor>;
  allTimezones?: Maybe<Array<Maybe<TimezoneInfo>>>;
  configs?: Maybe<ConfigsConnection>;
  isFbEmployee?: Maybe<Scalars["Boolean"]>;
  marketplace_explore?: Maybe<MarketplaceExploreConnection>;
  marketplace_settings?: Maybe<MarketPlaceSettings>;
  newsFeed?: Maybe<NewsFeedConnection>;
  notificationStories?: Maybe<NewsFeedConnection>;
  pendingPosts?: Maybe<PendingPostsConnection>;
  primaryEmail?: Maybe<Scalars["String"]>;
  timezoneEstimate?: Maybe<TimezoneInfo>;
};

export type ViewerConfigsArgs = {
  named?: InputMaybe<Array<InputMaybe<Scalars["String"]>>>;
};

export type ViewerMarketplace_ExploreArgs = {
  marketplace_browse_context?: InputMaybe<MarketplaceBrowseContext>;
  with_price_between?: InputMaybe<Array<InputMaybe<Scalars["Float"]>>>;
};

export type ViewerNewsFeedArgs = {
  after?: InputMaybe<Scalars["ID"]>;
  find?: InputMaybe<Scalars["ID"]>;
  first?: InputMaybe<Scalars["Int"]>;
};

export type ViewerNotificationStoriesArgs = {
  after?: InputMaybe<Scalars["ID"]>;
  first?: InputMaybe<Scalars["Int"]>;
};

export type ViewerPendingPostsArgs = {
  first?: InputMaybe<Scalars["Int"]>;
};

export type ViewerNotificationsUpdateAllSeenStateResponsePayload = {
  __typename?: "ViewerNotificationsUpdateAllSeenStateResponsePayload";
  stories?: Maybe<Array<Maybe<Story>>>;
};

export type WayPoint = {
  lat?: InputMaybe<Scalars["String"]>;
  lon?: InputMaybe<Scalars["String"]>;
};

export type SetLocationResponsePayload = {
  __typename?: "setLocationResponsePayload";
  clientMutationId?: Maybe<Scalars["String"]>;
  viewer?: Maybe<Viewer>;
};

export type TypeMap = {
  Actor: Actor;
  ActorNameChangeInput: ActorNameChangeInput;
  ActorNameChangePayload: ActorNameChangePayload;
  ActorSubscribeInput: ActorSubscribeInput;
  ActorSubscribeResponsePayload: ActorSubscribeResponsePayload;
  AllConcreteTypesImplementNode: AllConcreteTypesImplementNode;
  ApplicationRequestDeleteAllInput: ApplicationRequestDeleteAllInput;
  ApplicationRequestDeleteAllResponsePayload: ApplicationRequestDeleteAllResponsePayload;
  Boolean: Scalars["Boolean"];
  CheckinSearchInput: CheckinSearchInput;
  CheckinSearchResult: CheckinSearchResult;
  Comment: Comment;
  CommentBodiesConnection: CommentBodiesConnection;
  CommentBodiesEdge: CommentBodiesEdge;
  CommentBody: CommentBody;
  CommentCreateInput: CommentCreateInput;
  CommentCreateResponsePayload: CommentCreateResponsePayload;
  CommentCreateSubscriptionInput: CommentCreateSubscriptionInput;
  CommentDeleteInput: CommentDeleteInput;
  CommentDeleteResponsePayload: CommentDeleteResponsePayload;
  CommentfeedbackFeedback: CommentfeedbackFeedback;
  CommentsConnection: CommentsConnection;
  CommentsCreateInput: CommentsCreateInput;
  CommentsCreateResponsePayload: CommentsCreateResponsePayload;
  CommentsDeleteInput: CommentsDeleteInput;
  CommentsDeleteResponsePayload: CommentsDeleteResponsePayload;
  CommentsEdge: CommentsEdge;
  Config: Config;
  ConfigCreateSubscriptResponsePayload: ConfigCreateSubscriptResponsePayload;
  ConfigsConnection: ConfigsConnection;
  ConfigsConnectionEdge: ConfigsConnectionEdge;
  CropPosition: CropPosition;
  CustomNameRenderer: CustomNameRenderer;
  Date: Date;
  Entity: Entity;
  Environment: Environment;
  FakeNode: FakeNode;
  FeedUnit: FeedUnit;
  Feedback: Feedback;
  FeedbackLikeInput: FeedbackLikeInput;
  FeedbackLikeInputStrict: FeedbackLikeInputStrict;
  FeedbackLikeResponsePayload: FeedbackLikeResponsePayload;
  FeedbackcommentComment: FeedbackcommentComment;
  FileExtension: FileExtension;
  Float: Scalars["Float"];
  FriendsConnection: FriendsConnection;
  FriendsEdge: FriendsEdge;
  HasJsField: HasJsField;
  ID: Scalars["ID"];
  IDFieldIsID: IdFieldIsId;
  IDFieldIsIDNonNull: IdFieldIsIdNonNull;
  IDFieldIsInt: IdFieldIsInt;
  IDFieldIsIntNonNull: IdFieldIsIntNonNull;
  IDFieldIsListOfID: IdFieldIsListOfId;
  IDFieldIsObject: IdFieldIsObject;
  IDFieldIsString: IdFieldIsString;
  IDFieldIsStringNonNull: IdFieldIsStringNonNull;
  IDFieldTests: IdFieldTests;
  Image: Image;
  InputText: InputText;
  Int: Scalars["Int"];
  ItemFilterInput: ItemFilterInput;
  ItemFilterResult: ItemFilterResult;
  JSDependency: Scalars["JSDependency"];
  JSON: Scalars["JSON"];
  LikersEdge: LikersEdge;
  LikersOfContentConnection: LikersOfContentConnection;
  LocationInput: LocationInput;
  MarkdownCommentBody: MarkdownCommentBody;
  MarkdownUserNameData: MarkdownUserNameData;
  MarkdownUserNameRenderer: MarkdownUserNameRenderer;
  MarketPlaceSellLocation: MarketPlaceSellLocation;
  MarketPlaceSettings: MarketPlaceSettings;
  MarketplaceBrowseContext: MarketplaceBrowseContext;
  MarketplaceExploreConnection: MarketplaceExploreConnection;
  MaybeNode: MaybeNode;
  MaybeNodeInterface: MaybeNodeInterface;
  Mutation: Mutation;
  NameRendererContext: NameRendererContext;
  Named: Named;
  NeverNode: NeverNode;
  NewsFeedConnection: NewsFeedConnection;
  NewsFeedEdge: NewsFeedEdge;
  Node: Node;
  NodeSaveStateInput: NodeSaveStateInput;
  NodeSavedStateResponsePayload: NodeSavedStateResponsePayload;
  NonNode: NonNode;
  NonNodeNoID: NonNodeNoId;
  NonNodeStory: NonNodeStory;
  Page: Page;
  PageInfo: PageInfo;
  PendingPost: PendingPost;
  PendingPostsConnection: PendingPostsConnection;
  PendingPostsConnectionEdge: PendingPostsConnectionEdge;
  PersonalityTraits: PersonalityTraits;
  Phone: Phone;
  PhoneNumber: PhoneNumber;
  PhotoSize: PhotoSize;
  PhotoStory: PhotoStory;
  PlainCommentBody: PlainCommentBody;
  PlainUserNameData: PlainUserNameData;
  PlainUserNameRenderer: PlainUserNameRenderer;
  PlainUserRenderer: PlainUserRenderer;
  ProfilePictureOptions: ProfilePictureOptions;
  Query: Query;
  ReactFlightComponent: Scalars["ReactFlightComponent"];
  ReactFlightProps: Scalars["ReactFlightProps"];
  Route: Route;
  RouteStep: RouteStep;
  Screenname: Screenname;
  Segments: Segments;
  SegmentsEdge: SegmentsEdge;
  Settings: Settings;
  SimpleNamed: SimpleNamed;
  Story: Story;
  StoryAttachment: StoryAttachment;
  StoryCommentSearchInput: StoryCommentSearchInput;
  StorySearchInput: StorySearchInput;
  StoryType: StoryType;
  StoryUpdateInput: StoryUpdateInput;
  StoryUpdateResponsePayload: StoryUpdateResponsePayload;
  StreetAddress: StreetAddress;
  String: Scalars["String"];
  SubscribersConnection: SubscribersConnection;
  SubscribersEdge: SubscribersEdge;
  Subscription: Subscription;
  Task: Task;
  TestEnums: TestEnums;
  Text: Text;
  TimezoneInfo: TimezoneInfo;
  TopLevelCommentsConnection: TopLevelCommentsConnection;
  TopLevelCommentsOrdering: TopLevelCommentsOrdering;
  UnfriendInput: UnfriendInput;
  UnfriendResponsePayload: UnfriendResponsePayload;
  UpdateAllSeenStateInput: UpdateAllSeenStateInput;
  User: User;
  UserNameRenderable: UserNameRenderable;
  UserNameRenderer: UserNameRenderer;
  UserOrPage: UserOrPage;
  Viewer: Viewer;
  ViewerNotificationsUpdateAllSeenStateResponsePayload: ViewerNotificationsUpdateAllSeenStateResponsePayload;
  WayPoint: WayPoint;
  setLocationResponsePayload: SetLocationResponsePayload;
};
