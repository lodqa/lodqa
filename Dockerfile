FROM ruby:2.2-alpine

RUN apk update \
  && apk upgrade \
  && apk add --no-cache graphviz \
  && apk add --no-cache --virtual .eventmachine-builddeps g++ musl-dev make

RUN mkdir -p /app

COPY Gemfile /app
COPY Gemfile.lock /app

WORKDIR /app
RUN bundle install --jobs=4 --retry=10 --clean --without test development \
  && apk del .eventmachine-builddeps

CMD ["bundle", "exec", "rackup", "-o", "0.0.0.0"]
